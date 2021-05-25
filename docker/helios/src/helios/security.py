"""
Helios Security -- mostly access control

Ben Adida (ben@adida.net)
"""

# nicely update the wrapper function
from functools import update_wrapper

from django.urls import reverse
from django.core.exceptions import *
from django.http import *
from django.conf import settings
from django.contrib import messages

from .models import *
from helios_auth.security.datastore import get_user

from django.http import HttpResponseRedirect
import urllib.request, urllib.parse, urllib.error

import helios


# Middleware changed in 1.10: https://docs.djangoproject.com/en/2.2/topics/http/middleware/#upgrading-pre-django-1-10-style-middleware

# Original 1.8 middleware class provided a process_response method
# 
# class HSTSMiddleware:
#     def process_response(self, request, response):
#         if settings.STS:
#           response['Strict-Transport-Security'] = "max-age=31536000; includeSubDomains; preload"
#         return response


def hsts_middleware(get_response):
	# One-time configuration and initialization.

	def middleware(request):
		# Code to be executed for each request before
		# the view (and later middleware) are called.

		response = get_response(request)

		# Code to be executed for each request/response after
		# the view is called.
		if settings.STS:
			response['Strict-Transport-Security'] = "max-age=31536000; includeSubDomains; preload"

		return response

	return middleware


# current voter
def get_voter(request, user, election):
	"""
	return the current voter
	"""
	voter = None
	if 'CURRENT_VOTER_ID' in request.session:
		voter = Voter.objects.get(id=request.session['CURRENT_VOTER_ID'])
		if voter.election != election:
			voter = None

	if not voter:
		if user:
			# caso exista um usuário logado, carrega o eleitor que contenha o mesmo login
			voter = Voter.get_by_election_and_voter_id(election, user.user_id)

	return voter


# a function to check if the current user is a trustee
HELIOS_TRUSTEE_UUID = 'helios_trustee_uuid'


def get_logged_in_trustee(request):
	if HELIOS_TRUSTEE_UUID in request.session:
		try:
			return Trustee.get_by_uuid(request.session[HELIOS_TRUSTEE_UUID])
		except Trustee.DoesNotExist:
			logout_trustee(request)
	
	return None


def set_logged_in_trustee(request, trustee):
	request.session[HELIOS_TRUSTEE_UUID] = trustee.uuid


def logout_trustee(request):
	if HELIOS_TRUSTEE_UUID in request.session:
		del request.session[HELIOS_TRUSTEE_UUID]


#
# some common election checks
#
def do_election_checks(election, props):
	# frozen
	if 'frozen' in props:
		frozen = props['frozen']
	else:
		frozen = None

	# newvoters (open for registration)
	if 'newvoters' in props:
		newvoters = props['newvoters']
	else:
		newvoters = None

	# frozen check
	if frozen != None:
		if frozen and not election.frozen_at:
			raise PermissionDenied()
		if not frozen and election.frozen_at:
			raise PermissionDenied()

	# open for new voters check
	if newvoters != None:
		if election.can_add_voters() != newvoters:
			raise PermissionDenied()


def get_election_by_uuid(uuid):
	if not uuid:
		raise Exception("Nenhum ID de eleição")

	return Election.get_by_uuid(uuid)


# decorator for views that pertain to an election
# takes parameters:
# frozen - is the election frozen
# newvoters - does the election accept new voters
def election_view(**checks):
	def election_view_decorator(func):
		def election_view_wrapper(request, election_uuid=None, *args, **kw):
			election = get_election_by_uuid(election_uuid)

			if not election:
				raise Http404

			# do checks
			do_election_checks(election, checks)

			if election.private_p and not checks.get('allow_logins', False):
				if not user_can_see_election(request, election):
					auth_system_url = None
					query_string = urllib.parse.urlencode({'return_url': request.get_full_path()})
					
					# se esta propriedade não está definida, significa que a eleição ainda não foi congelada
					# e não deve ser visualizada pelos usuários
					if election.eligibility is None:
						raise PermissionDenied()
					
					# se o usuário já estiver logado e não pode ver a eleição, ele é redirecionado à págiona inicial do sistema (com mensagem de alerta)
					if get_user(request) is not None:
						from server_ui.views import home
						messages.warning(request, 'Você não possui acesso a esta eleição.')
						return HttpResponseRedirect(reverse(home))
					
					# caso ele não esteja logado, é redirecionado para fazer login
					if checks.get('redirect_to_login', True):
						auth_systems = [e['auth_system'] for e in election.eligibility]
						auth_system = 'password' if len(auth_systems) == 0 else auth_systems[0]
						if auth_system == 'password':
							from .views import password_voter_login
							auth_system_url = reverse(password_voter_login, args=[election.uuid])
						else:
							from helios_auth.views import start
							auth_system_url = reverse(start, args=[auth_system])
						
						return HttpResponseRedirect(f'{auth_system_url}?{query_string}')
					else:
						return HttpResponse('Unauthorized', status=401)
					

			return func(request, election, *args, **kw)

		return update_wrapper(election_view_wrapper, func)

	return election_view_decorator


def user_can_admin_election(user, election):
	if not user:
		return False

	# election or site administrator
	return election.admin == user or user.admin_p


def user_can_see_election(request, election):
	user = get_user(request)

	if not election.private_p:
		return True

	# election is private

	# but maybe this user is the administrator?
	if user_can_admin_election(user, election):
		return True

	# or maybe this is a trustee of the election?
	trustee = get_logged_in_trustee(request)
	if trustee and trustee.election.uuid == election.uuid:
		return True

	# then this user has to be a voter
	return (get_voter(request, user, election) != None)


def api_client_can_admin_election(api_client, election):
	return election.api_client == api_client and api_client != None


# decorator for checking election admin access, and some properties of the election
# frozen - is the election frozen
# newvoters - does the election accept new voters
def election_admin(**checks):
	def election_admin_decorator(func):
		def election_admin_wrapper(request, election_uuid=None, *args, **kw):
			election = get_election_by_uuid(election_uuid)

			user = get_user(request)
			if not user_can_admin_election(user, election):
				raise PermissionDenied()

			# do checks
			do_election_checks(election, checks)

			return func(request, election, *args, **kw)

		return update_wrapper(election_admin_wrapper, func)

	return election_admin_decorator


def trustee_check(func):
	def trustee_check_wrapper(request, election_uuid, trustee_uuid, *args, **kwargs):
		election = get_election_by_uuid(election_uuid)

		trustee = Trustee.get_by_election_and_uuid(election, trustee_uuid)

		if trustee == get_logged_in_trustee(request):
			return func(request, election, trustee, *args, **kwargs)
		else:
			raise PermissionDenied()

	return update_wrapper(trustee_check_wrapper, func)


def can_create_election(request):
	user = get_user(request)
	if not user:
		return False

	if helios.ADMIN_ONLY:
		return user.admin_p
	else:
		return user.can_create_election()


def user_can_feature_election(user, election):
	if not user:
		return False

	return user.admin_p
