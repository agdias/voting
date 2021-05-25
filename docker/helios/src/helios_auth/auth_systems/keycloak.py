from django.conf import settings
from django.core.mail import send_mail
from django.http import *
from django.urls import reverse

from keycloak.realm import KeycloakRealm

# instancia os objetos utilizados para gerenciar o usuário pelo keycloak
from helios.utils import remove_html

keycloak_realm = KeycloakRealm(server_url=settings.KEYCLOAK_SERVER_URL, realm_name=settings.KEYCLOAK_REALM)
oidc_client = keycloak_realm.open_id_connect(client_id=settings.KEYCLOAK_CLIENT_ID, client_secret=settings.KEYCLOAK_CLIENT_SECRET)

# display tweaks
LOGIN_MESSAGE = "Log in with Keycloak"
STATUS_UPDATES = False


def get_auth_url(request, redirect_url):
	manager_url = settings.SECURE_URL_HOST + reverse(keycloak_login_manager)
	return oidc_client.authorization_url(redirect_uri=manager_url)


def keycloak_login_manager(request):
	code = request.GET.get('code', None)
	if code is None:
		# se não possui o código de autenticação, redireciona para a página inicial
		return HttpResponseRedirect('/')

	# carrega as informações do usuário
	authorization_code = oidc_client.authorization_code(code, settings.SECURE_URL_HOST + reverse(keycloak_login_manager))
	user_info = oidc_client.userinfo(authorization_code['access_token'])

	# em caso de erro, redireciona para página adequada
	if user_info is None:
		from helios_auth.view_utils import render_template
		return render_template(request, 'error', {'error': 'Não foi possível carregar as informações do usuário'})

	# grava as informações na sessão para uso posterior
	# guarda o refresh_token que é utilizado para deslogar o usuário
	user_info['refresh_token'] = authorization_code['refresh_token']
	request.session['keycloak_user'] = user_info

	# redireciona para a página original do sistema
	from helios_auth.views import after
	return HttpResponseRedirect(reverse(after))


def get_user_info_after_auth(request):
	# recupera as informações da sessão
	user_info = request.session['keycloak_user']
	return {
		'type': 'keycloak',
		'user_id': user_info['preferred_username'],
		'name': user_info['name'],
		'info': {
			'email': user_info['email']
		},
		'token': {
			'refresh_token': user_info['refresh_token']
		}
	}


def send_message(user_id, name, user_info, subject, body):
	send_mail(subject, remove_html(body), settings.SERVER_EMAIL, ["%s <%s>" % (name, user_info['email'])], fail_silently=False, html_message=body)


def do_logout(user):
	# desloga o usuário no keycloak (usando o refresh_token)
	oidc_client.logout(user['token']['refresh_token'])
