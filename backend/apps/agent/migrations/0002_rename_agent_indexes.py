from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('agent', '0001_initial'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='agentauditlog',
            new_name='agent_agent_company_ff9f95_idx',
            old_name='agent_audit_company_idx',
        ),
        migrations.RenameIndex(
            model_name='agentauditlog',
            new_name='agent_agent_user_id_0034af_idx',
            old_name='agent_audit_user_idx',
        ),
        migrations.RenameIndex(
            model_name='agentauditlog',
            new_name='agent_agent_tool_na_9b05bb_idx',
            old_name='agent_audit_tool_idx',
        ),
        migrations.RenameIndex(
            model_name='agentconnectioncode',
            new_name='agent_agent_code_6fea9d_idx',
            old_name='agent_code_value_exp_idx',
        ),
        migrations.RenameIndex(
            model_name='agentconversation',
            new_name='agent_agent_company_c71ade_idx',
            old_name='agent_conv_company_user_idx',
        ),
        migrations.RenameIndex(
            model_name='agentinboundmessage',
            new_name='agent_agent_receive_d6533d_idx',
            old_name='agent_inbound_received_idx',
        ),
        migrations.RenameIndex(
            model_name='agentmemberaccess',
            new_name='agent_agent_company_3d6178_idx',
            old_name='agent_member_company_enabled_idx',
        ),
        migrations.RenameIndex(
            model_name='agentpendingaction',
            new_name='agent_agent_company_64f3e6_idx',
            old_name='agent_pending_company_idx',
        ),
        migrations.RenameIndex(
            model_name='agentpendingaction',
            new_name='agent_agent_status_1f01ec_idx',
            old_name='agent_pending_status_idx',
        ),
        migrations.RenameIndex(
            model_name='agentuserchannel',
            new_name='agent_agent_company_8c0ca3_idx',
            old_name='agent_channel_company_type_idx',
        ),
        migrations.RenameIndex(
            model_name='agentuserchannel',
            new_name='agent_agent_channel_503d96_idx',
            old_name='agent_channel_type_chat_idx',
        ),
    ]
