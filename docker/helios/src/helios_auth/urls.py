"""
Authentication URLs

Ben Adida (ben@adida.net)
"""

from django.conf.urls import url

from helios_auth import views
from settings import AUTH_ENABLED_AUTH_SYSTEMS

urlpatterns = [  # basic static stuff
	url(r'^$', views.index, name='auth-views-index'),
	url(r'^logout$', views.logout, name='auth-views-logout'),
	url(r'^start/(?P<system_name>.*)$', views.start, name='auth-views-start'),

	# weird facebook constraint for trailing slash
	url(r'^after/$', views.after, name='views-after'),
	url(r'^why$', views.perms_why, name='views-perms-why'),
	url(r'^after_intervention$', views.after_intervention, name='views-after-intervention')
]

# password auth
if 'password' in AUTH_ENABLED_AUTH_SYSTEMS:
	from helios_auth.auth_systems.password import password_login_view, password_forgotten_view

	urlpatterns.append(url(r'^password/login', password_login_view, name='password-login-view'))
	urlpatterns.append(url(r'^password/forgot', password_forgotten_view, name='password-forgotten-view'))

# twitter
if 'twitter' in AUTH_ENABLED_AUTH_SYSTEMS:
	from helios_auth.auth_systems.twitter import follow_view

	urlpatterns.append(url(r'^twitter/follow', follow_view, name='follow-view'))

# LDAP
if 'ldap' in AUTH_ENABLED_AUTH_SYSTEMS:
	from helios_auth.auth_systems.ldapauth import ldap_login_view

	urlpatterns.append(url(r'^ldap/login', ldap_login_view, name='ldap-login-view'))

# Keycloak
if 'keycloak' in AUTH_ENABLED_AUTH_SYSTEMS:
	from helios_auth.auth_systems.keycloak import keycloak_login_manager

	urlpatterns.append(url(r'^keycloak/login', keycloak_login_manager, name='keycloak-login-manager'))

# Sistema Dummy de login (utilizar somente para testes!)
if 'dummy' in AUTH_ENABLED_AUTH_SYSTEMS:
	from helios_auth.auth_systems.dummy import dummy_login_view

	urlpatterns.append(url(r'^dummy/login', dummy_login_view, name='dummy-login-view'))
