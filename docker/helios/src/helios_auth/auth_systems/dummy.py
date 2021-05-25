from django import forms
from django.conf import settings
from django.urls import reverse
from django.http import HttpResponseRedirect

# some parameters to indicate that status updating is possible
STATUS_UPDATES = False

LOGIN_MESSAGE = "Log in with Dummy"


class LoginForm(forms.Form):
	username = forms.CharField(max_length=250)
	password = forms.CharField(widget=forms.PasswordInput(), max_length=100)


def dummy_login_view(request):
	from helios_auth.view_utils import render_template
	from helios_auth.views import after

	error = None

	if request.method == "GET":
		form = LoginForm()
	else:
		form = LoginForm(request.POST)

		request.session['auth_system_name'] = 'dummy'

		if form.is_valid():
			username = form.cleaned_data['username'].strip()
			password = form.cleaned_data['password'].strip()
			
			if username == password:
				request.session['dummy_user'] = {
					'username': username,
					'name': username.upper(),
					'email': f'{username}@example.com'
				}
				return HttpResponseRedirect(reverse(after))
			else:
				error = 'Bad Username or Password'

	return render_template(request, 'dummy/login', {
		'form': form,
		'error': error,
		'enabled_auth_systems': settings.AUTH_ENABLED_AUTH_SYSTEMS
	})


def get_user_info_after_auth(request):
	user_info = request.session['dummy_user']
	return {
		'type': 'dummy',
		'user_id': user_info['username'],
		'name': user_info['name'],
		'info': {
			'email': user_info['email']
		},
		'token': None
	}


def get_auth_url(request, redirect_url=None):
	return reverse(dummy_login_view)


def send_message(user_id, name, user_info, subject, body):
	import logging
	logging.debug(user_id, name, user_info, subject, body)


def can_create_election(user_id, user_info):
	return True
