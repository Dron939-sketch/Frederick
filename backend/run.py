"""
run.py — Wrapper that patches endpoints before starting the app.
Used instead of 'uvicorn main:app' to fix find-doubles without editing main.py.
"""
import os
import json
import logging
from main import app, db, limiter
from fastapi import Request

logger = logging.getLogger(__name__)


# ============================================
# PATCHED: /api/psychometric/find-doubles
# Fixes: extracts mode/goal/gender params, applies gender filter
# ============================================

# Remove old route
for i, route in enumerate(app.routes):
    if hasattr(route, 'path') and route.path == '/api/psychometric/find-doubles':
        app.routes.pop(i)
        logger.info('Removed old find-doubles route')
        break


@app.get('/api/psychometric/find-doubles')
@limiter.limit('10/minute')
async def find_psychometric_doubles_v2(
    request: Request,
    user_id: str,
    mode: str = 'twin',
    goal: str = None,
    gender: str = None,
    distance: str = None,
    limit: int = 10
):
    try:
        from repositories.user_repo import UserRepository

        try:
            user_id_for_db = int(user_id)
        except (ValueError, TypeError):
            user_id_for_db = user_id

        # Get current user's profile
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT profile FROM fredi_users WHERE user_id::text = $1",
                str(user_id_for_db)
            )
        
        profile = {}
        if row and row['profile']:
            profile = row['profile'] if isinstance(row['profile'], dict) else json.loads(row['profile'])

        logger.info(f"🔍 find-doubles: user={user_id}, has_profile={bool(profile)}, profile_keys={list(profile.keys())[:5] if profile else []}")
        
        behavioral_levels = profile.get('behavioral_levels', {})

        def last_val(arr, default=4):
            if isinstance(arr, list) and arr:
                return arr[-1]
            if isinstance(arr, (int, float)):
                return arr
            return default

        vectors = {
            'СБ': last_val(behavioral_levels.get('СБ')),
            'ТФ': last_val(behavioral_levels.get('ТФ')),
            'УБ': last_val(behavioral_levels.get('УБ')),
            'ЧВ': last_val(behavioral_levels.get('ЧВ'))
        }

        # Build query with optional gender filter
        sql = """
            SELECT DISTINCT u.user_id, u.profile
            FROM fredi_users u
            WHERE u.user_id::text != $1
            AND u.profile IS NOT NULL
            AND u.profile != '{}'::jsonb
        """
        params = [str(user_id_for_db)]

        if gender and gender != 'any':
            # Filter by gender from user context
            sql += """
                AND EXISTS (
                    SELECT 1 FROM fredi_user_contexts c
                    WHERE c.user_id = u.user_id AND c.gender = $2
                )
            """
            params.append(gender)

        sql += f" LIMIT {limit * 3}"

        async with db.get_connection() as conn:
            rows = await conn.fetch(sql, *params)

        logger.info(f"🔍 find-doubles: user={user_id}, vectors={vectors}, found {len(rows)} candidates in DB")

        # Calculate similarity
        doubles = []
        for row in rows:
            other_profile = row['profile'] if isinstance(row['profile'], dict) else json.loads(row['profile'])
            other_behavioral = other_profile.get('behavioral_levels', {})

            other_vectors = {
                'СБ': last_val(other_behavioral.get('СБ')),
                'ТФ': last_val(other_behavioral.get('ТФ')),
                'УБ': last_val(other_behavioral.get('УБ')),
                'ЧВ': last_val(other_behavioral.get('ЧВ'))
            }

            total_diff = sum(abs(vectors.get(k, 4) - other_vectors.get(k, 4)) for k in ['СБ', 'ТФ', 'УБ', 'ЧВ'])

            if mode == 'twin':
                # Twin: minimize difference
                similarity = max(0, min(100, int((1 - total_diff / 24) * 100)))
            else:
                # Match: complementary profiles score higher for some goals
                base = max(0, min(100, int((1 - total_diff / 24) * 100)))
                if goal in ('lover', 'spouse'):
                    # For romantic goals: moderate difference is attractive
                    complement = min(100, int((total_diff / 12) * 100))
                    similarity = int(base * 0.4 + complement * 0.6)
                elif goal in ('companion', 'employee', 'boss'):
                    # For business: similar thinking + complementary skills
                    similarity = base
                else:
                    similarity = base

            # Get context for display
            async with db.get_connection() as conn:
                ctx = await conn.fetchrow(
                    "SELECT name, age, city, gender FROM fredi_user_contexts WHERE user_id = $1",
                    row['user_id']
                )

            doubles.append({
                'user_id': row['user_id'],
                'name': (ctx['name'] if ctx and ctx['name'] else f'User_{row["user_id"]}'),
                'age': ctx['age'] if ctx else None,
                'city': ctx['city'] if ctx else None,
                'gender': ctx['gender'] if ctx else None,
                'profile_code': other_profile.get('display_name', ''),
                'profile_type': other_profile.get('perception_type', ''),
                'vectors': other_vectors,
                'similarity': similarity,
            })

        doubles.sort(key=lambda x: x['similarity'], reverse=True)
        exact_doubles = [d for d in doubles if d['similarity'] >= 70]
        nearby_profiles = [d for d in doubles if 30 <= d['similarity'] < 70]

        logger.info(f"🔍 find-doubles: {len(doubles)} total, {len(exact_doubles)} exact(>=70%), {len(nearby_profiles)} nearby(30-70%)")

        return {
            'success': True,
            'doubles': exact_doubles[:limit],
            'nearby': nearby_profiles[:limit],
            'results': (exact_doubles + nearby_profiles)[:limit],
            'total_found': len(doubles),
            'your_profile': {
                'profile_code': profile.get('display_name'),
                'vectors': vectors,
                'profile_type': profile.get('perception_type')
            }
        }
    except Exception as e:
        logger.error(f'Error finding doubles for user {user_id}: {e}')
        return {'success': False, 'error': str(e), 'doubles': [], 'results': []}


logger.info('run.py: find-doubles endpoint patched with filters support')

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run(app, host='0.0.0.0', port=port, workers=1)
