from django.db import migrations, models
import django.db.models.deletion


def create_legacy_accounts(apps, schema_editor):
    Supplier = apps.get_model('core', 'Supplier')
    SupplierAccount = apps.get_model('core', 'SupplierAccount')

    for supplier in Supplier.objects.all().iterator():
        has_credentials = any([
            supplier.api_key,
            supplier.api_login,
            supplier.api_password,
            supplier.api_token,
            supplier.api_refresh_token,
        ])
        if not has_credentials or SupplierAccount.objects.filter(supplier=supplier).exists():
            continue
        SupplierAccount.objects.create(
            supplier=supplier,
            name='Основний акаунт',
            api_key=supplier.api_key,
            api_login=supplier.api_login,
            api_password=supplier.api_password,
            api_token=supplier.api_token,
            api_refresh_token=supplier.api_refresh_token,
            api_token_expires_at=supplier.api_token_expires_at,
            browser_fingerprint=supplier.browser_fingerprint,
            is_active=True,
            is_default=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_company_phones'),
    ]

    operations = [
        migrations.CreateModel(
            name='SupplierAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('api_key', models.CharField(blank=True, max_length=255, null=True)),
                ('api_login', models.CharField(blank=True, max_length=255, null=True)),
                ('api_password', models.CharField(blank=True, max_length=255, null=True)),
                ('api_token', models.TextField(blank=True, null=True)),
                ('api_refresh_token', models.TextField(blank=True, null=True)),
                ('api_token_expires_at', models.DateTimeField(blank=True, null=True)),
                ('browser_fingerprint', models.CharField(blank=True, max_length=128, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_default', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='accounts', to='core.supplier')),
            ],
            options={'ordering': ['-is_default', 'name', 'id']},
        ),
        migrations.AddField(
            model_name='orderpart',
            name='supplier_account_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='orderpart',
            name='supplier_account',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='order_parts', to='core.supplieraccount'),
        ),
        migrations.AddField(
            model_name='orderpart',
            name='supplier_ref',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='order_parts', to='core.supplier'),
        ),
        migrations.AddConstraint(
            model_name='supplieraccount',
            constraint=models.UniqueConstraint(fields=('supplier', 'name'), name='core_supacc_name_unique'),
        ),
        migrations.AddIndex(
            model_name='supplieraccount',
            index=models.Index(fields=['supplier', 'is_active', 'is_default'], name='core_supacc_active_default_idx'),
        ),
        migrations.RunPython(create_legacy_accounts, migrations.RunPython.noop),
    ]
