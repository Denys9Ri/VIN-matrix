from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_supplier_accounts'),
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SupplierAccountBinding',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_supplier_account_bindings', to='core.company')),
                ('legal_entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='supplier_account_bindings', to='finance.legalentity')),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_account_bindings', to='core.supplier')),
                ('supplier_account', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='finance_binding', to='core.supplieraccount')),
            ],
            options={
                'ordering': ['supplier_id', 'legal_entity_id', 'supplier_account_id'],
                'indexes': [models.Index(fields=['company', 'supplier', 'legal_entity'], name='finance_supacc_binding_lookup_idx')],
                'constraints': [models.UniqueConstraint(fields=('company', 'supplier', 'legal_entity'), name='finance_supplier_entity_account_uniq')],
            },
        ),
    ]
