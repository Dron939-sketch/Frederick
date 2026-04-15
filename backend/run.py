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
# v3: single JOIN query, no similarity threshold, returns ALL candidates
# ============================================

# Remove old route
for i, route in enumerate(app.routes):
    if hasattr(route, 'path') and route.path == '/api/psychometric/find-doubles':
        app.routes.pop(i)
        logger.info('Removed old find-doubles route')
        break


@app.get('/api/psychometric/find-doubles')
@limiter.limit('10/minute')
async def find_psychometric_doubles_v3(
    request: Request,
    user_id: str,
    mode: str = 'twin',
    goal: str = None,
    gender: str = None,
    distance: str = None,
    limit: int = 30
):
    try:
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

        # Single JOIN query — no N+1
        sql = """
            SELECT u.user_id, u.profile,
                   c.name, c.age, c.city, c.gender
            FROM fredi_users u
            LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id
            WHERE u.user_id::text != $1
              AND u.profile IS NOT NULL
              AND u.profile != '{}'::jsonb
              AND u.profile -> 'behavioral_levels' IS NOT NULL
        """
        params = [str(user_id_for_db)]

        if gender and gender != 'any':
            sql += " AND c.gender = $2"
            params.append(gender)

        sql += " ORDER BY u.last_activity DESC NULLS LAST LIMIT 200"

        async with db.get_connection() as conn:
            rows = await conn.fetch(sql, *params)

        logger.info(f"🔍 find-doubles: user={user_id}, vectors={vectors}, candidates={len(rows)}")

        # Calculate similarity for all candidates
        all_candidates = []
        for r in rows:
            other_profile = r['profile'] if isinstance(r['profile'], dict) else json.loads(r['profile'])
            other_behavioral = other_profile.get('behavioral_levels', {})

            # Skip if no real vectors
            if not other_behavioral:
                continue

            other_vectors = {
                'СБ': last_val(other_behavioral.get('СБ')),
                'ТФ': last_val(other_behavioral.get('ТФ')),
                'УБ': last_val(other_behavioral.get('УБ')),
                'ЧВ': last_val(other_behavioral.get('ЧВ'))
            }

            total_diff = sum(abs(vectors.get(k, 4) - other_vectors.get(k, 4)) for k in ['СБ', 'ТФ', 'УБ', 'ЧВ'])

            if mode == 'twin':
                similarity = max(0, min(100, int((1 - total_diff / 24) * 100)))
            else:
                base = max(0, min(100, int((1 - total_diff / 24) * 100)))
                if goal in ('lover', 'spouse'):
                    complement = min(100, int((total_diff / 12) * 100))
                    similarity = int(base * 0.4 + complement * 0.6)
                else:
                    similarity = base

            all_candidates.append({
                'user_id': r['user_id'],
                'name': r['name'] or f'User_{r["user_id"]}',
                'age': r['age'],
                'city': r['city'],
                'gender': r['gender'],
                'profile_code': other_profile.get('display_name', ''),
                'profile_type': other_profile.get('perception_type', ''),
                'vectors': other_vectors,
                'similarity': similarity,
            })

        # Sort by similarity descending
        all_candidates.sort(key=lambda x: x['similarity'], reverse=True)

        # Split into categories but return ALL — let frontend decide
        exact = [c for c in all_candidates if c['similarity'] >= 70]
        nearby = [c for c in all_candidates if 30 <= c['similarity'] < 70]
        rest = [c for c in all_candidates if c['similarity'] < 30]

        # Results = all candidates sorted, limited
        results = all_candidates[:limit]

        logger.info(f"🔍 find-doubles: total={len(all_candidates)}, exact={len(exact)}, nearby={len(nearby)}, rest={len(rest)}, returning={len(results)}")

        return {
            'success': True,
            'doubles': exact[:limit],
            'nearby': nearby[:limit],
            'results': results,
            'total_found': len(all_candidates),
            'your_profile': {
                'profile_code': profile.get('display_name'),
                'vectors': vectors,
                'profile_type': profile.get('perception_type')
            }
        }
    except Exception as e:
        logger.error(f'Error finding doubles for user {user_id}: {e}', exc_info=True)
        return {'success': False, 'error': str(e), 'doubles': [], 'results': []}


logger.info('run.py: find-doubles endpoint patched v3 (JOIN, no threshold, limit 200)')

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run(app, host='0.0.0.0', port=port, workers=1)
