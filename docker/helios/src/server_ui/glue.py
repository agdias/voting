"""
Glue some events together 
"""

from django.conf import settings
from django.urls import reverse
from helios.view_utils import render_template_raw
import helios.views, helios.signals

from server_ui import views


def vote_cast_send_message(user, voter, election, cast_vote, **kwargs):
	## FIXME: this doesn't work for voters that are not also users
	# prepare the message
	subject_template = 'email/cast_vote_subject.txt'
	body_template = 'email/cast_vote_body.txt'

	extra_vars = {
		'election': election,
		'voter': voter,
		'cast_vote': cast_vote,
		'cast_vote_url': helios.views.get_castvote_url(cast_vote),
		'custom_subject': f"{election.name} - voto depositado"
	}
	subject = render_template_raw(None, subject_template, extra_vars)
	body = render_template_raw(None, body_template, extra_vars)

	# send it via the notification system associated with the auth system
	user.send_message(subject, body)


helios.signals.vote_cast.connect(vote_cast_send_message)


def election_tallied(election, **kwargs):
	pass


helios.signals.election_tallied.connect(election_tallied)