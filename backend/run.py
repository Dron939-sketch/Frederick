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
# PATCHED: /api/psychometric/find-doubles v4
# Enriched profiles: perception_type, thinking_level, deep_patterns
# ============================================

# Remove old route
for i, route in enumerate(app.routes):
    if hasattr(route, 'path') and route.path == '/api/psychometric/find-doubles':
        app.routes.pop(i)
        logger.info('Removed old find-doubles route')
        break


def _last_val(arr, default=4):
    if isinstance(arr, list) and arr:
        return arr[-1]
    if isinstance(arr, (int, float)):
        return arr
    return default


def _extract_profile_data(profile_dict):
    """Extract all useful fields from a user profile JSONB."""
    bl = profile_dict.get('behavioral_levels', {})
    vectors = {
        'СБ': _last_val(bl.get('СБ')),
        'ТФ': _last_val(bl.get('ТФ')),
        'УБ': _last_val(bl.get('УБ')),
        'ЧВ': _last_val(bl.get('ЧВ'))
    }

    deep = profile_dict.get('deep_patterns') or profile_dict.get('profile_data', {}).get('deep_patterns', {})
    attachment = None
    if isinstance(deep, dict):
        attachment = deep.get('attachment') or deep.get('attachment_style')

    perception = profile_dict.get('perception_type', '')
    thinking = profile_dict.get('thinking_level')
    if thinking is None:
        thinking = profile_dict.get('profile_data', {}).get('thinking_level')

    return {
        'vectors': vectors,
        'perception_type': perception,
        'thinking_level': int(thinking) if thinking else None,
        'attachment': attachment,
        'profile_code': profile_dict.get('display_name', ''),
    }


@app.get('/api/psychometric/find-doubles')
@limiter.limit('10/minute')
async def find_psychometric_doubles_v4(
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

        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT profile FROM fredi_users WHERE user_id::text = $1",
                str(user_id_for_db)
            )

        profile = {}
        if row and row['profile']:
            profile = row['profile'] if isinstance(row['profile'], dict) else json.loads(row['profile'])

        user_data = _extract_profile_data(profile)
        vectors = user_data['vectors']

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

        sql += " ORDER BY RANDOM() LIMIT 300"

        async with db.get_connection() as conn:
            rows = await conn.fetch(sql, *params)

        logger.info(f"🔍 find-doubles v4: user={user_id}, vectors={vectors}, candidates={len(rows)}")

        all_candidates = []
        for r in rows:
            other_profile = r['profile'] if isinstance(r['profile'], dict) else json.loads(r['profile'])
            if not other_profile.get('behavioral_levels'):
                continue

            other = _extract_profile_data(other_profile)
            ov = other['vectors']

            total_diff = sum(abs(vectors.get(k, 4) - ov.get(k, 4)) for k in ['СБ', 'ТФ', 'УБ', 'ЧВ'])

            if mode == 'twin':
                similarity = max(0, min(100, int((1 - total_diff / 24) * 100)))
            else:
                base = max(0, min(100, int((1 - total_diff / 24) * 100)))
                if goal in ('lover', 'spouse'):
                    complement = min(100, int((total_diff / 12) * 100))
                    similarity = int(base * 0.4 + complement * 0.6)
                else:
                    similarity = base

            display_name = r['name'] or other['perception_type'] or 'Пользователь'

            all_candidates.append({
                'user_id': r['user_id'],
                'name': display_name,
                'age': r['age'],
                'city': r['city'],
                'gender': r['gender'],
                'profile_code': other['profile_code'],
                'profile_type': other['perception_type'],
                'thinking_level': other['thinking_level'],
                'attachment': other['attachment'],
                'vectors': ov,
                'similarity': similarity,
            })

        all_candidates.sort(key=lambda x: x['similarity'], reverse=True)
        results = all_candidates[:limit]

        logger.info(f"🔍 find-doubles v4: total={len(all_candidates)}, returning={len(results)}")

        return {
            'success': True,
            'doubles': [c for c in results if c['similarity'] >= 70],
            'nearby': [c for c in results if 30 <= c['similarity'] < 70],
            'results': results,
            'total_found': len(all_candidates),
            'your_profile': {
                'profile_code': user_data['profile_code'],
                'vectors': vectors,
                'profile_type': user_data['perception_type'],
                'thinking_level': user_data['thinking_level'],
                'attachment': user_data['attachment']
            }
        }
    except Exception as e:
        logger.error(f'Error finding doubles for user {user_id}: {e}', exc_info=True)
        return {'success': False, 'error': str(e), 'doubles': [], 'results': []}


logger.info('run.py: find-doubles endpoint patched v4 (enriched profiles)')

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run(app, host='0.0.0.0', port=port, workers=1)
