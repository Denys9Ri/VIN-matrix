from django.contrib.auth.models import User
from django.db import connection, transaction

from .models import Company, Employee, PlatformClient


def _table_exists(cursor, table_name):
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        )
        """,
        [table_name],
    )
    return bool(cursor.fetchone()[0])


def _column_exists(cursor, table_name, column_name):
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
        )
        """,
        [table_name, column_name],
    )
    return bool(cursor.fetchone()[0])


def _exec_if_table_and_columns(cursor, sql, table_name, columns=None, params=None):
    columns = columns or []
    if not _table_exists(cursor, table_name):
        return 0
    for column in columns:
        if not _column_exists(cursor, table_name, column):
            return 0
    cursor.execute(sql, params or [])
    return cursor.rowcount


def _get_user_company_id(user_id):
    try:
        return Company.objects.only('id').get(owner_id=user_id).id
    except Company.DoesNotExist:
        return None


def _get_admin_user(exclude_user_id=None):
    qs = User.objects.filter(is_staff=True, is_active=True)
    if exclude_user_id:
        qs = qs.exclude(id=exclude_user_id)
    return qs.order_by('id').first()


def hard_delete_account(user):
    """
    Fully remove a platform account and its CRM data.

    This is intentionally more explicit than user.delete(): old deployments have
    partially repaired legacy tables, so a simple cascade can fail and roll back.
    """
    if not user:
        return {'deleted': False, 'message': 'Користувача не знайдено.'}

    if user.is_staff or user.is_superuser:
        raise ValueError('Платформного адміністратора видаляти не можна.')

    user_id = user.id
    company_id = _get_user_company_id(user_id)
    admin_user = _get_admin_user(exclude_user_id=user_id)

    with transaction.atomic():
        # If this user was a partner/owner for clients, do not delete those clients.
        # Move them to a platform admin first.
        if admin_user:
            PlatformClient.objects.filter(assigned_owner_id=user_id).update(
                assigned_owner=admin_user,
                referred_by=admin_user,
            )
            PlatformClient.objects.filter(referred_by_id=user_id).update(referred_by=admin_user)

        PlatformClient.objects.filter(user_id=user_id).delete()
        Employee.objects.filter(user_id=user_id).delete()

        with connection.cursor() as cursor:
            if company_id:
                _exec_if_table_and_columns(
                    cursor,
                    "DELETE FROM core_orderpart WHERE visit_id IN (SELECT id FROM core_visit WHERE company_id = %s)",
                    'core_orderpart',
                    ['visit_id'],
                    [company_id],
                )
                _exec_if_table_and_columns(
                    cursor,
                    "DELETE FROM core_orderservice WHERE visit_id IN (SELECT id FROM core_visit WHERE company_id = %s)",
                    'core_orderservice',
                    ['visit_id'],
                    [company_id],
                )
                _exec_if_table_and_columns(cursor, "DELETE FROM core_visit WHERE company_id = %s", 'core_visit', ['company_id'], [company_id])
                _exec_if_table_and_columns(cursor, "DELETE FROM core_inventoryitem WHERE company_id = %s", 'core_inventoryitem', ['company_id'], [company_id])
                _exec_if_table_and_columns(cursor, "DELETE FROM core_category WHERE company_id = %s", 'core_category', ['company_id'], [company_id])
                _exec_if_table_and_columns(cursor, "DELETE FROM core_supplier WHERE company_id = %s", 'core_supplier', ['company_id'], [company_id])
                _exec_if_table_and_columns(cursor, "DELETE FROM core_servicecatalog WHERE company_id = %s", 'core_servicecatalog', ['company_id'], [company_id])
                _exec_if_table_and_columns(cursor, "DELETE FROM core_employee WHERE company_id = %s", 'core_employee', ['company_id'], [company_id])

                if _table_exists(cursor, 'crm_visit'):
                    _exec_if_table_and_columns(
                        cursor,
                        "DELETE FROM crm_visitservice WHERE visit_id IN (SELECT id FROM crm_visit WHERE company_id = %s)",
                        'crm_visitservice',
                        ['visit_id'],
                        [company_id],
                    )
                    _exec_if_table_and_columns(cursor, "DELETE FROM crm_visit WHERE company_id = %s", 'crm_visit', ['company_id'], [company_id])
                _exec_if_table_and_columns(
                    cursor,
                    "DELETE FROM crm_visitservice WHERE service_catalog_id IN (SELECT id FROM crm_servicecatalog WHERE company_id = %s)",
                    'crm_visitservice',
                    ['service_catalog_id'],
                    [company_id],
                )
                _exec_if_table_and_columns(cursor, "DELETE FROM crm_servicecatalog WHERE company_id = %s", 'crm_servicecatalog', ['company_id'], [company_id])
                _exec_if_table_and_columns(cursor, "DELETE FROM crm_client WHERE company_id = %s", 'crm_client', ['company_id'], [company_id])
                _exec_if_table_and_columns(cursor, "DELETE FROM core_company WHERE id = %s", 'core_company', ['id'], [company_id])

            _exec_if_table_and_columns(cursor, "DELETE FROM django_admin_log WHERE user_id = %s", 'django_admin_log', ['user_id'], [user_id])
            _exec_if_table_and_columns(cursor, "DELETE FROM auth_user_groups WHERE user_id = %s", 'auth_user_groups', ['user_id'], [user_id])
            _exec_if_table_and_columns(cursor, "DELETE FROM auth_user_user_permissions WHERE user_id = %s", 'auth_user_user_permissions', ['user_id'], [user_id])
            _exec_if_table_and_columns(cursor, "DELETE FROM authtoken_token WHERE user_id = %s", 'authtoken_token', ['user_id'], [user_id])
            cursor.execute("DELETE FROM auth_user WHERE id = %s", [user_id])

        if User.objects.filter(id=user_id).exists():
            raise ValueError('Акаунт не вдалося видалити з бази.')

    return {'deleted': True, 'user_id': user_id}
