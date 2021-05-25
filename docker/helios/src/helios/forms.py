"""
Forms for Helios
"""

from django.apps import apps
from django.conf import settings

from .fields import *
from .widgets import XDSoftDateTimePickerInput

Election = apps.get_model('helios', 'Election')


class ElectionForm(forms.Form):
	short_name = forms.SlugField(label='Nome abreviado', max_length=40, help_text='Sem espaços, será parte da URL da sua eleição, e.g. meu-clube-2014')
	name = forms.CharField(label='Nome', max_length=100, widget=forms.TextInput(attrs={'size': 60}), help_text='O nome apresentável para a sua eleição, p.ex.: Eleição do Meu Clube 2014.')
	description = forms.CharField(label='Descrição', max_length=4000, widget=forms.Textarea(attrs={'cols': 70, 'wrap': 'soft'}), required=False)
	election_type = forms.ChoiceField(label="Tipo", choices=Election.ELECTION_TYPES)
	use_voter_aliases = forms.BooleanField(label='Usar pseudônimo de eleitores', required=False, initial=False, help_text='Se marcada, a identidade dos eleitores será substituída por pseudônimos, e.g. "V12", no centro de rastreamento de cédulas.')

	use_advanced_audit_features = forms.BooleanField(label='Usar auditoria de cédulas', required=False, initial=False, help_text='Desabilite essa opção se você quiser uma interface de usuário mais simples.')
	randomize_answer_order = forms.BooleanField(label='Randomizar ordem dos candidatos', required=False, initial=False, help_text='Habilite essa opção se você quiser que os candidatos apareçam em ordem aleatória para cada eleitor.')

	cast_limit = forms.IntegerField(required=False, min_value=0, initial=1, label='Limite de cédulas', help_text='Limita o número de cédulas que podem ser depositadas. O valor "0" não impõe restrição.')

	private_p = forms.BooleanField(label='Privada?', required=False, initial=False, help_text='Uma eleição privada só é visível para eleitores registrados.')
	help_email = forms.CharField(label='E-mail para ajuda', required=False, initial="", help_text='Endereço de email que os eleitores devem usar para pedir ajuda.')

	if settings.ALLOW_ELECTION_INFO_URL:
		election_info_url = forms.CharField(label="URL de download de informações da Eleição", required=False, initial="", help_text="a URL de um documento PDF que contém informações extras, e.g., biografias e declarações dos candidatos")

	# times
	voting_starts_at = forms.DateTimeField(label="Início da votação", help_text='Data e horário de início da votação', widget=XDSoftDateTimePickerInput, input_formats=['%d/%m/%Y %H:%M'], required=False)
	voting_ends_at = forms.DateTimeField(label="Término da votação", help_text='Data e horário de término da votação', widget=XDSoftDateTimePickerInput, input_formats=['%d/%m/%Y %H:%M'], required=False)


class ElectionTimeExtensionForm(forms.Form):
	voting_extended_until = forms.DateTimeField(label="Estender votação até", help_text='Data e horário da extensão da votação', widget=XDSoftDateTimePickerInput, input_formats=['%d/%m/%Y %H:%M'], required=False)


class EmailVotersForm(forms.Form):
	subject = forms.CharField(label="Assunto", max_length=80)
	body = forms.CharField(label="Mensagem", max_length=4000, widget=forms.Textarea, required=False)
	send_to = forms.ChoiceField(label="Enviar", initial="all", choices=[('all', 'todos os eleitores'), ('voted', 'eleitores que depositaram uma cédula'), ('not-voted', 'eleitores que ainda não depositaram uma cédula')])


class TallyNotificationEmailForm(forms.Form):
	subject = forms.CharField(label="Assunto", max_length=80)
	body = forms.CharField(label="Mensagem", max_length=2000, widget=forms.Textarea, required=False)
	send_to = forms.ChoiceField(label="Enviar", choices=[('all', 'todos os eleitores'), ('voted', 'eleitores que depositaram uma cédula'), ('none', 'nenhum - você tem certeza disso?')])


class VoterPasswordForm(forms.Form):
	voter_id = forms.CharField(label="ID do Eleitor", max_length=50)
	password = forms.CharField(label="Senha", widget=forms.PasswordInput(), max_length=100)
