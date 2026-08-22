from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import OrderService, ServiceCatalog


def normalize_service_name(value):
    return ' '.join(str(value or '').split()).strip()


@receiver(post_save, sender=OrderService, dispatch_uid='core_order_service_to_catalog')
def sync_new_order_service_to_catalog(sender, instance, created, **kwargs):
    """Add a newly typed STO work to the reusable price list once.

    OrderService keeps the price snapshot used in the visit.  The catalog is a
    reusable price list, so an existing catalog price is never overwritten by a
    visit-specific discount or custom price.
    """
    if not created or not instance.visit_id:
        return

    company = getattr(instance.visit, 'company', None)
    if not company or getattr(company, 'business_type', 'sto') == 'store':
        return

    name = normalize_service_name(instance.name)
    if not name:
        return

    if ServiceCatalog.objects.filter(company=company, name__iexact=name).exists():
        return

    ServiceCatalog.objects.create(
        company=company,
        name=name,
        price=instance.price,
    )
