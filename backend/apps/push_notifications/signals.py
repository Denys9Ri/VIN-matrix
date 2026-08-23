import json
import logging

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.core.models import OrderPart, OrderService, Visit

from .service import send_company_push


logger = logging.getLogger('vin_matrix.push')

VISIT_STATUS_LABELS = {
    'SELECTION': 'В обробці',
    'ORDERED': 'Очікує товар',
    'IN_PROGRESS': 'В роботі',
    'DONE': 'Готово',
    'SHIPPED': 'Відправлено',
    'COMPLETED': 'Виконано',
    'CANCELLED': 'Скасовано',
}

PART_STATUS_LABELS = {
    'WAITING': 'Очікується',
    'ORDERED': 'Замовлено',
    'IN_TRANSIT': 'У дорозі',
    'RECEIVED': 'Отримано',
    'INSTALLED': 'Встановлено',
    'RETURNED': 'Повернено',
    'CANCELLED': 'Скасовано',
}

SERVICE_STATUS_LABELS = {
    'PENDING': 'Очікує',
    'IN_PROGRESS': 'В роботі',
    'DONE': 'Готово',
    'COMPLETED': 'Виконано',
    'CANCELLED': 'Скасовано',
}

PAYMENT_STATUS_LABELS = {
    'unpaid': 'Не оплачено',
    'prepaid': 'Передплата',
    'paid': 'Оплачено',
    'cod': 'Післяплата',
    'debt': 'Борг',
}


def _remember_old(instance, model, fields):
    if not instance.pk:
        return
    try:
        old = model.objects.only(*fields).get(pk=instance.pk)
    except model.DoesNotExist:
        return
    for field in fields:
        setattr(instance, f'_push_old_{field}', getattr(old, field, None))


def _label(mapping, value):
    return mapping.get(str(value or ''), str(value or '—'))


def _visit_name(visit):
    plate = str(getattr(visit, 'plate', '') or '').strip()
    return plate or f'Візит №{visit.id}'


def _delivery_state(value):
    if not value:
        return ''
    data = value
    if isinstance(value, str):
        try:
            data = json.loads(value)
        except Exception:
            return value.strip()[:120]
    if not isinstance(data, dict):
        return str(data)[:120]
    return str(
        data.get('delivery_status_text')
        or data.get('status_text')
        or data.get('delivery_status')
        or data.get('status')
        or data.get('ttn')
        or data.get('tracking_number')
        or ''
    ).strip()[:120]


def _safe_send(company, payload, category):
    try:
        send_company_push(company, payload, category=category)
    except Exception:
        logger.exception('operational_push_signal_failed category=%s', category)


@receiver(pre_save, sender=Visit, dispatch_uid='push_visit_capture_old')
def capture_visit_old(sender, instance, **kwargs):
    _remember_old(instance, Visit, ('status', 'payment_status', 'delivery_data'))


@receiver(post_save, sender=Visit, dispatch_uid='push_visit_changes')
def push_visit_changes(sender, instance, created, **kwargs):
    if created:
        return

    old_status = getattr(instance, '_push_old_status', instance.status)
    if str(old_status) != str(instance.status):
        _safe_send(instance.company, {
            'title': f'🚗 {_visit_name(instance)} · статус змінено',
            'body': f'{instance.client or "Клієнт"}: {_label(VISIT_STATUS_LABELS, old_status)} → {_label(VISIT_STATUS_LABELS, instance.status)}',
            'url': f'/visits?visit_id={instance.id}&open=board',
            'tag': f'visit-status-{instance.id}-{instance.status}',
        }, 'status_updates')

    old_payment = getattr(instance, '_push_old_payment_status', instance.payment_status)
    if str(old_payment) != str(instance.payment_status):
        _safe_send(instance.company, {
            'title': f'💳 {_visit_name(instance)} · оплата',
            'body': f'{instance.client or "Клієнт"}: {_label(PAYMENT_STATUS_LABELS, old_payment)} → {_label(PAYMENT_STATUS_LABELS, instance.payment_status)}',
            'url': f'/attention?visit_id={instance.id}&type=payment',
            'tag': f'visit-payment-{instance.id}-{instance.payment_status}',
        }, 'payments')

    old_delivery = getattr(instance, '_push_old_delivery_data', instance.delivery_data)
    old_delivery_state = _delivery_state(old_delivery)
    new_delivery_state = _delivery_state(instance.delivery_data)
    if old_delivery_state != new_delivery_state and new_delivery_state:
        _safe_send(instance.company, {
            'title': f'🚚 {_visit_name(instance)} · доставка',
            'body': f'{instance.client or "Клієнт"}: {old_delivery_state or "без статусу"} → {new_delivery_state}',
            'url': f'/visits?visit_id={instance.id}&tab=delivery&open=board',
            'tag': f'visit-delivery-{instance.id}-{new_delivery_state[:40]}',
        }, 'delivery')


@receiver(pre_save, sender=OrderPart, dispatch_uid='push_part_capture_old')
def capture_part_old(sender, instance, **kwargs):
    _remember_old(instance, OrderPart, ('status',))


@receiver(post_save, sender=OrderPart, dispatch_uid='push_part_changes')
def push_part_changes(sender, instance, created, **kwargs):
    if created:
        return
    old_status = getattr(instance, '_push_old_status', instance.status)
    if str(old_status) == str(instance.status):
        return
    visit = instance.visit
    part = f'{instance.brand or ""} {instance.article or ""}'.strip() or instance.name or 'Запчастина'
    _safe_send(visit.company, {
        'title': f'📦 {part} · статус змінено',
        'body': f'{_visit_name(visit)}: {_label(PART_STATUS_LABELS, old_status)} → {_label(PART_STATUS_LABELS, instance.status)}',
        'url': f'/visits?visit_id={visit.id}&tab=parts&open=board',
        'tag': f'part-status-{instance.id}-{instance.status}',
    }, 'inventory')


@receiver(pre_save, sender=OrderService, dispatch_uid='push_service_capture_old')
def capture_service_old(sender, instance, **kwargs):
    _remember_old(instance, OrderService, ('status',))


@receiver(post_save, sender=OrderService, dispatch_uid='push_service_changes')
def push_service_changes(sender, instance, created, **kwargs):
    if created:
        return
    old_status = getattr(instance, '_push_old_status', instance.status)
    if str(old_status) == str(instance.status):
        return
    visit = instance.visit
    _safe_send(visit.company, {
        'title': f'🔧 {instance.name or "Робота"} · статус змінено',
        'body': f'{_visit_name(visit)}: {_label(SERVICE_STATUS_LABELS, old_status)} → {_label(SERVICE_STATUS_LABELS, instance.status)}',
        'url': f'/visits?visit_id={visit.id}&open=board',
        'tag': f'service-status-{instance.id}-{instance.status}',
    }, 'status_updates')
