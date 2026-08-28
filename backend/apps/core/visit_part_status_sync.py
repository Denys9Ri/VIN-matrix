"""Keep part logistics in sync when a visit is actually finished.

The user can still manage part statuses manually while the visit is active (and
also afterwards).  We only apply the automatic ARRIVED status once, on the
transition into a final visit state, and only to known non-final logistics
statuses.  Explicit exception/final statuses are never overwritten.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import OrderPart, Visit


FINAL_VISIT_STATUSES = frozenset({'DONE', 'COMPLETED', 'ISSUED'})

# These statuses mean the part is still somewhere in the normal procurement /
# delivery flow.  When the whole visit is marked ready/completed, treating them
# as received matches the business meaning of that final visit state.
AUTO_ARRIVAL_PART_STATUSES = frozenset({
    'WAITING',
    'ORDERED',
    'PENDING',
    'DRAFT',
    'SELECTION',
    'PROCESSING',
    'IN_PROCESS',
    'IN_TRANSIT',
    'ROAD',
    'DELIVERY',
})

TARGET_PART_STATUS = 'ARRIVED'


@receiver(pre_save, sender=Visit, dispatch_uid='core_visit_parts_capture_old_status')
def capture_visit_status_before_save(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        instance._parts_sync_old_status = (
            Visit.objects.only('status').get(pk=instance.pk).status
        )
    except Visit.DoesNotExist:
        pass


@receiver(post_save, sender=Visit, dispatch_uid='core_visit_parts_sync_on_final_status')
def sync_parts_when_visit_finishes(sender, instance, created, **kwargs):
    if created:
        return

    old_status = str(getattr(instance, '_parts_sync_old_status', instance.status) or '').upper()
    new_status = str(instance.status or '').upper()

    # Important: only react to the transition.  A later save on an already
    # finished visit must not undo a user's deliberate manual part status.
    if old_status == new_status:
        return
    if new_status not in FINAL_VISIT_STATUSES:
        return
    if old_status in FINAL_VISIT_STATUSES:
        return

    # QuerySet.update is intentional: this is one business-level sync action,
    # not N user-initiated part status changes.  It also avoids firing one push
    # notification per part when a visit with many items is closed.
    OrderPart.objects.filter(
        visit_id=instance.pk,
        status__in=AUTO_ARRIVAL_PART_STATUSES,
    ).update(status=TARGET_PART_STATUS)
