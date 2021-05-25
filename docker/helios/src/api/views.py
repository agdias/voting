#!/usr/bin/python
# -*- coding: utf-8 -*-

__author__ = 'sadj'

from django.http import Http404
from django.urls import reverse

import settings
from helios.models import Election
from helios.view_utils import return_json
from helios.views import election_shortcut, election_vote_shortcut
from helios_auth.models import User


@return_json
def elections_by_user(request, login):
	user = User.get_by_id(login)
	
	# se o usuário não for encontrado, retorna 404
	if user is None:
		raise Http404
	
	# para formatar datas (models.DateTimeField)
	fmt_date = lambda x: None if x is None else x.__str__()
	
	elections = Election.get_by_user_as_voter(user, archived_p=False)
	
	fronzen_only = request.GET.get('frozen_only', 'false') == 'true'
	if fronzen_only:
		elections = elections.exclude(frozen_at=None)
	
	output = []
	for election in elections:
		output.append({
			'name': election.name,
			'description': election.description,
			'election_url': settings.URL_HOST + reverse(election_shortcut, args=[election.short_name]),
			'vote_url': settings.URL_HOST + reverse(election_vote_shortcut, args=[election.short_name]),
			'starts_at': fmt_date(election.voting_starts_at),
			'ends_at': fmt_date(election.voting_extended_until or election.voting_ends_at),
			'fronzen_at': fmt_date(election.frozen_at),
			'result_released_at': fmt_date(election.result_released_at)
		})
	return output
