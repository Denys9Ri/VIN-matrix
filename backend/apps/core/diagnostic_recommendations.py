from __future__ import annotations

import json
import re
from typing import Dict, Tuple

from django.db import connection

from .models import VehicleRecommendation


DIAGNOSTIC_LABELS = {
    'engine': 'Двигун',
    'brakes': 'Гальмівна система',
    'suspension': 'Ходова',
    'fluids': 'Рідини',
    'tires': 'Шини',
    'lights': 'Світло',
    'battery': 'АКБ',
    'computer': 'Помилки / компʼютер',
}

FLAGGED_STATUSES = {'attention', 'critical'}
STATUS_LABELS = {
    'attention': 'Увага',
    'critical': 'Критично',
}


def _visit_car_label(visit) -> str:
    try:
        payload = json.loads(visit.delivery_data or '{}') if str(visit.delivery_data or '').strip().startswith('{') else {}
    except Exception:
        payload = {}
    return ' '.join(str(value).strip() for value in [payload.get('brand'), payload.get('model')] if value).strip()


def _visit_mileage(visit):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT mileage FROM core_visitacceptanceact WHERE visit_id=%s LIMIT 1', [visit.id])
            row = cursor.fetchone()
        if row and row[0] is not None:
            return int(row[0])
    except Exception:
        pass

    try:
        payload = json.loads(visit.delivery_data or '{}') if str(visit.delivery_data or '').strip().startswith('{') else {}
        value = payload.get('mileage') or payload.get('probig')
        return int(str(value).replace(' ', '')) if value not in [None, ''] else None
    except Exception:
        return None


def _due_mileage_from_note(note: str, visit):
    if not note:
        return None
    match = re.search(r'через\s+([\d\s]{1,10})\s*(?:км|кілометр(?:ів|и|а)?)\b', note.lower())
    if not match:
        return None
    try:
        offset = int(match.group(1).replace(' ', ''))
    except (TypeError, ValueError):
        return None
    current = _visit_mileage(visit)
    return current + offset if current is not None and offset > 0 else None


def _auto_title(label: str, note: str, severity: str) -> str:
    note = str(note or '').strip()
    if note:
        return note[:255]
    if severity == 'critical':
        return f'Терміново перевірити: {label}'[:255]
    return f'Перевірити: {label}'[:255]


def _auto_description(label: str, severity: str) -> str:
    return f'Виявлено під час діагностики. Розділ: {label}. Статус: {STATUS_LABELS.get(severity, severity)}.'


def _recommendation_from_item(company, visit, item):
    recommendation_id = item.get('recommendation_id') if isinstance(item, dict) else None
    if recommendation_id:
        recommendation = VehicleRecommendation.objects.filter(
            id=recommendation_id,
            company=company,
            visit=visit,
        ).first()
        if recommendation:
            return recommendation

    auto_title = str(item.get('recommendation_auto_title') or '').strip() if isinstance(item, dict) else ''
    if auto_title:
        return VehicleRecommendation.objects.filter(
            company=company,
            visit=visit,
            title=auto_title,
        ).order_by('id').first()
    return None


def sync_diagnostic_recommendations(company, visit, checklist, user) -> Tuple[Dict, Dict[str, int]]:
    """Synchronise Attention/Critical diagnostic items into recommendations.

    Recommendation IDs and last auto-generated text are stored inside the diagnostic
    checklist JSON. This avoids schema changes and lets later manual edits survive
    subsequent diagnostic saves.
    """
    safe_checklist = dict(checklist or {})
    stats = {'created': 0, 'updated': 0, 'cancelled': 0}

    for key, label in DIAGNOSTIC_LABELS.items():
        item = dict(safe_checklist.get(key) or {})
        severity = str(item.get('status') or 'not_checked')
        note = str(item.get('note') or '').strip()
        recommendation = _recommendation_from_item(company, visit, item)

        if severity in FLAGGED_STATUSES:
            generated_title = _auto_title(label, note, severity)
            generated_description = _auto_description(label, severity)
            old_auto_title = str(item.get('recommendation_auto_title') or '').strip()
            old_auto_description = str(item.get('recommendation_auto_description') or '').strip()

            if recommendation is None:
                recommendation = VehicleRecommendation.objects.create(
                    company=company,
                    visit=visit,
                    client=visit.client,
                    phone=visit.phone,
                    plate=visit.plate,
                    car=_visit_car_label(visit),
                    title=generated_title,
                    description=generated_description,
                    due_mileage=_due_mileage_from_note(note, visit),
                    status=VehicleRecommendation.STATUS_ACTIVE,
                    created_by=user,
                )
                stats['created'] += 1
            else:
                changed_fields = []
                if not recommendation.title or not old_auto_title or recommendation.title == old_auto_title:
                    if recommendation.title != generated_title:
                        recommendation.title = generated_title
                        changed_fields.append('title')
                if not recommendation.description or not old_auto_description or recommendation.description == old_auto_description:
                    if recommendation.description != generated_description:
                        recommendation.description = generated_description
                        changed_fields.append('description')
                if recommendation.status == VehicleRecommendation.STATUS_CANCELLED:
                    recommendation.status = VehicleRecommendation.STATUS_ACTIVE
                    changed_fields.append('status')
                if recommendation.due_mileage is None:
                    inferred_due_mileage = _due_mileage_from_note(note, visit)
                    if inferred_due_mileage:
                        recommendation.due_mileage = inferred_due_mileage
                        changed_fields.append('due_mileage')
                if changed_fields:
                    changed_fields.append('updated_at')
                    recommendation.save(update_fields=list(dict.fromkeys(changed_fields)))
                    stats['updated'] += 1

            item['recommendation_id'] = recommendation.id
            item['recommendation_auto_title'] = generated_title
            item['recommendation_auto_description'] = generated_description
        elif recommendation and recommendation.status == VehicleRecommendation.STATUS_ACTIVE:
            recommendation.status = VehicleRecommendation.STATUS_CANCELLED
            recommendation.save(update_fields=['status', 'updated_at'])
            stats['cancelled'] += 1

        safe_checklist[key] = item

    return safe_checklist, stats
