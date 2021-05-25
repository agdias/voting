function show_error(message) {
    $('#page').html('<div class="text-center h4 mt-4"><span class="fas fa-fw fa-times text-danger"></span>' + message + "</div>");
}

// utils
BOOTH = {};

BOOTH.setup_templates = async function() {
	if (BOOTH.templates_setup_p)
		return;

    /* carrega os templates */
    var cache_bust = "?cb=" + new Date().getTime();
    var templates = ['header', 'election', 'question', 'seal', 'audit', 'footer'];
    templates.map(function(x, i) {
        $.get('/static/templates/booth/' + x + '.html' + cache_bust, function(data) {
		    $.templates(x, data);
	    });
	});

    /* garante que todos os templates foram carregados antes de prosseguir */
    while (templates.filter(x => $.templates[x] === undefined).length > 0) {
        await new Promise(r => setTimeout(r, 200));
    }

	BOOTH.templates_setup_p = true;
};

// set up the message when navigating away
BOOTH.started_p = false;

window.onbeforeunload = function(evt) {
	if (!BOOTH.started_p)
		return;

	if (typeof evt == 'undefined') {
		evt = window.event;
	}

	var message = "Se você sair dessa página com uma votação em andamento, sua cédula será perdida.";

	if (evt) {
		evt.returnValue = message;
	}

	return message;
};

BOOTH.exit = function() {
	if (confirm("Tem certeza de que você deseja sair da cabina e perder toda a informação de sua cédula atual?")) {
		BOOTH.started_p = false;
		window.location = BOOTH.election.cast_url;
	}
};

BOOTH.setup_ballot = function(election) {
	BOOTH.ballot = {};

	// dirty markers for encryption (mostly for async)
	BOOTH.dirty = [];

	// each question starts out with an empty array answer
	// and a dirty bit to make sure we encrypt
	BOOTH.ballot.answers = [];
	$(BOOTH.election.questions).each(function(i, x) {
		BOOTH.ballot.answers[i] = [];
		BOOTH.dirty[i] = true;
	});
};

// all ciphertexts to null
BOOTH.reset_ciphertexts = function() {
	BOOTH.encrypted_answers.forEach(function(enc_answer, ea_num) {
		BOOTH.launch_async_encryption_answer(ea_num);
	});
};

BOOTH.log = function(msg) {
	if (typeof(console) != undefined)
		console.log(msg);
};

BOOTH.setup_workers = function(election_raw_json) {
	// async?
	if (!BOOTH.synchronous) {
		// prepare spots for encrypted answers
		// and one worker per question
		BOOTH.encrypted_answers = [];
		BOOTH.answer_timestamps = [];
		BOOTH.worker = new window.Worker("/static/js/boothworker-single.js");
		BOOTH.worker.postMessage({
			'type': 'setup',
			'election': election_raw_json
		});

		BOOTH.worker.onmessage = function(event) {
			// logging
			if (event.data.type == 'log')
				return BOOTH.log(event.data.msg);

			// result of encryption
			if (event.data.type == 'result') {
				// this check ensures that race conditions
				// don't screw up votes.
				if (event.data.id == BOOTH.answer_timestamps[event.data.q_num]) {
					BOOTH.encrypted_answers[event.data.q_num] = HELIOS.EncryptedAnswer.fromJSONObject(event.data.encrypted_answer, BOOTH.election);
					BOOTH.log("got encrypted answer " + event.data.q_num);
				} else {
					BOOTH.log("no way jose");
				}
			}
		};

		$(BOOTH.election.questions).each(function(q_num, q) {
			BOOTH.encrypted_answers[q_num] = null;
		});
	}
};

function escape_html(content) {
	return $('<div/>').text(content).html();
}

BOOTH.setup_election = function(raw_json, election_metadata) {
	// IMPORTANT: we use the raw JSON for safer hash computation
	// so that we are using the JSON serialization of the SERVER
	// to compute the hash, not the JSON serialization in JavaScript.
	// the main reason for this is unicode representation: the Python approach
	// appears to be safer.
	BOOTH.election = HELIOS.Election.fromJSONString(raw_json);

	// FIXME: we shouldn't need to set both, but right now we are doing so
	// because different code uses each one. Bah. Need fixing.
	BOOTH.election.hash = b64_sha256(raw_json);
	BOOTH.election.election_hash = BOOTH.election.hash

	// async?
	BOOTH.setup_workers(raw_json);

	document.title += ' - ' + BOOTH.election.name;

	// escape election fields
	$(['description', 'name']).each(function(i, field) {
		BOOTH.election[field] = escape_html(BOOTH.election[field]);
	});

	// TODO: escape question and answers

	// whether the election wants candidate order randomization or not
	// we set up an ordering array so that the rest of the code is
	// less error-prone.
	BOOTH.election.question_answer_orderings = [];
	$(BOOTH.election.questions).each(function(i, question) {
		var ordering = new Array(question.answers.length);

		// initialize array so it is the identity permutation
		$(ordering).each(function(j, answer) {
			ordering[j] = j;
		});

		// if we want reordering, then we shuffle the array
		if (election_metadata && election_metadata.randomize_answer_order) {
			shuffleArray(ordering);
		}

		BOOTH.election.question_answer_orderings[i] = ordering;
	});

    $('#header').html($.render.header({'election': BOOTH.election}));
    $('#footer').html($.render.footer({'election': BOOTH.election, 'election_metadata': BOOTH.election_metadata}));
	BOOTH.setup_ballot();
};

BOOTH.show = function(el) {
	$('.panel').hide();
	el.show();
	return el;
};

BOOTH.show_election = function() {
    BOOTH.show($('#election_div')).html($.render.election({'election': BOOTH.election}));
};

BOOTH.launch_async_encryption_answer = function(question_num) {
	BOOTH.answer_timestamps[question_num] = new Date().getTime();
	BOOTH.encrypted_answers[question_num] = null;
	BOOTH.dirty[question_num] = false;
	BOOTH.worker.postMessage({
		'type': 'encrypt',
		'q_num': question_num,
		'answer': BOOTH.ballot.answers[question_num],
		'id': BOOTH.answer_timestamps[question_num]
	});
};

// check if the current question is ok
BOOTH.validate_question = function(question_num) {
	// check if enough answers are checked
	if (BOOTH.ballot.answers[question_num].length < BOOTH.election.questions[question_num].min) {
		var mensagem = "Você precisa selecionar ao menos " + ((BOOTH.election.questions[question_num].min == 1) ? "uma opção" : (BOOTH.election.questions[question_num].min + " opções."));
		alert(mensagem);
		return false;
	}

	// if we need to launch the worker, let's do it
	if (!BOOTH.synchronous) {
		// we need a unique ID for this to ensure that old results
		// don't mess things up. Using timestamp.
		// check if dirty
		if (BOOTH.dirty[question_num]) {
			BOOTH.launch_async_encryption_answer(question_num);
		}
	}
	return true;
};

BOOTH.validate_and_confirm = function(question_num) {
	if (BOOTH.validate_question(question_num)) {
		BOOTH.seal_ballot();
	}
};

BOOTH.next = function(question_num) {
	if (BOOTH.validate_question(question_num)) {
		BOOTH.show_question(question_num + 1);
	}
};

BOOTH.previous = function(question_num) {
	var validar = ($('#nextStep').length > 0);
	if (!validar || BOOTH.validate_question(question_num)) {
		BOOTH.show_question(question_num - 1);
	}
};

// http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffleArray(array) {
	var currentIndex = array.length,
		temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;
}

BOOTH.show_question = function(question_num) {
	BOOTH.started_p = true;

	// the first time we hit the last question, we enable the review all button
	if (question_num == BOOTH.election.questions.length - 1)
		BOOTH.all_questions_seen = true;

	BOOTH.show_progress('1');
	var question_data = {
		'question_num': question_num,
		'last_question_num': BOOTH.election.questions.length - 1,
		'question': BOOTH.election.questions[question_num],
		'show_reviewall': BOOTH.all_questions_seen,
		'answer_ordering': BOOTH.election.question_answer_orderings[question_num]
	};

	BOOTH.show($('#question_div')).html($.render.question(question_data));
//	BOOTH.show($('#question_div')).processTemplate({
//		'question_num': question_num,
//		'last_question_num': BOOTH.election.questions.length - 1,
//		'question': BOOTH.election.questions[question_num],
//		'show_reviewall': BOOTH.all_questions_seen,
//		'answer_ordering': BOOTH.election.question_answer_orderings[question_num]
//	});

	// fake clicking through the answers, to trigger the disabling if need be
	// first we remove the answers array
	var answer_array = BOOTH.ballot.answers[question_num];
	BOOTH.ballot.answers[question_num] = [];

	// we should not set the dirty bit here, so we save it away
	var old_dirty = BOOTH.dirty[question_num];
	$(answer_array).each(function(i, ans) {
		BOOTH.click_checkbox_script(question_num, ans, true);
	});
	BOOTH.dirty[question_num] = old_dirty;
};



BOOTH.click_checkbox_script = function(question_num, answer_num) {
	document.forms['answer_form']['answer_' + question_num + '_' + answer_num].click();
};

BOOTH.click_checkbox = function(question_num, answer_num, checked_p) {
	// keep track of dirty answers that need encrypting
	BOOTH.dirty[question_num] = true;

	if (checked_p) {
		// multiple click events shouldn't screw this up
		if ($(BOOTH.ballot.answers[question_num]).index(answer_num) == -1)
			BOOTH.ballot.answers[question_num].push(answer_num);

		$('#answer_label_' + question_num + "_" + answer_num).addClass('selected');
	} else {
		BOOTH.ballot.answers[question_num] = UTILS.array_remove_value(BOOTH.ballot.answers[question_num], answer_num);
		$('#answer_label_' + question_num + "_" + answer_num).removeClass('selected');
	}

	if (BOOTH.election.questions[question_num].max != null && BOOTH.ballot.answers[question_num].length >= BOOTH.election.questions[question_num].max) {
		// disable the other checkboxes
		$('.ballot_answer').each(function(i, checkbox) {
			if (!checkbox.checked)
				checkbox.disabled = true;
		});

		// do the warning only if the question allows more than one option, otherwise it's confusing
		if (BOOTH.election.questions[question_num].max > 1) {
			$('#warning_box').html("<strong>Número máximo de opções selecionadas.</strong><br />Para mudar sua opção, é preciso desmarcar uma da seleção atual.").removeClass('d-none');
		}
	} else {
		// enable the other checkboxes
		$('.ballot_answer').each(function(i, checkbox) {
			checkbox.disabled = false;
		});
		$('#warning_box').html("").addClass('d-none');
	}
};

BOOTH.show_processing_before = function(str_to_execute) {
	$('#processing_div').html("<h3 align='center'>Processando...</h3>");
	BOOTH.show($('#processing_div'));

	// add a timeout so browsers like Safari actually display the processing message
	setTimeout(str_to_execute, 250);
};

BOOTH.show_encryption_message_before = function(func_to_execute) {
	BOOTH.show_progress('2');
	BOOTH.show($('#encrypting_div'));

	func_to_execute();
};

BOOTH.load_and_setup_election = function(election_url) {
	// the hash will be computed within the setup function call now
	$.get(election_url, {}, function(raw_json) {
		// let's also get the metadata
		$.getJSON(election_url + "meta", {}, function(election_metadata) {
			BOOTH.election_metadata = election_metadata;
			BOOTH.setup_election(raw_json, election_metadata);
			BOOTH.show_election();
			BOOTH.election_url = election_url;
		});
	}, 'text').fail(function(xhr, status, error) {
	    var mensagem = null;
	    switch(xhr.status) {
	        case 403:
	            mensagem = 'O acesso a esta eleição não é possível neste momento.';
	            break;

	        case 401:
	            mensagem = 'Você não está logado. Tente acessar o link da Eleição novamente.';
	            break;

	        default:
	            mensagem = 'Erro desconhecido.';
	            break;
	    }

	    if (mensagem != null) {
	        show_error(mensagem);
	    }
	});


	if (USE_SJCL) {
		// get more randomness from server
		$.get(election_url + "get_randomness", {}, function(raw_json) {
			sjcl.random.addEntropy(JSON.parse(raw_json).randomness);
		}, 'text');
	}
};

BOOTH.hide_progress = function() {
	$('#progress_nav').hide();
};

BOOTH.show_progress = function(step_num) {
	let nav = $('#progress_nav')
	nav.show().find('a').removeClass('active').addClass('disabled').eq(step_num - 1).addClass('active').removeClass('disabled');
};

BOOTH.so_lets_go = async function() {
	BOOTH.hide_progress();

	await BOOTH.setup_templates();

	// election URL
	var election_url = $.query.get('election_url');
	var election_regex = RegExp('^/helios/elections/[0-9a-f]{8}-[0-9a-f]{4}-[14][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}/$');
	if (!election_regex.test(election_url)) {
		alert('As informações para apresentação desta eleição estão incorretas.');
		return;
	}
	BOOTH.load_and_setup_election(election_url);
};

BOOTH.nojava = function() {
	// in the case of Chrome, we get here when Java
	// is disabled, instead of detecting the problem earlier.
	// because navigator.javaEnabled() still returns true.
	// $('#election_div').hide();
	// $('#error_div').show();
	USE_SJCL = true;
	sjcl.random.startCollectors();
	BigInt.setup(BOOTH.so_lets_go);
};
BOOTH.ready_p = false;
$(document).ready(function() {
	if (USE_SJCL) {
		sjcl.random.startCollectors();
	}

	// we're asynchronous if we have SJCL and Worker
	BOOTH.synchronous = !(USE_SJCL && window.Worker);

	// we do in the browser only if it's asynchronous
	BigInt.in_browser = !BOOTH.synchronous;

	// set up dummy bigint for fast parsing and serialization
	if (!BigInt.in_browser)
		BigInt = BigIntDummy;

	BigInt.setup(BOOTH.so_lets_go, BOOTH.nojava);
});


BOOTH.check_encryption_status = function() {
	var progress = BOOTH.progress.progress();
	if (progress == "" || progress == null)
		progress = "0";

	$('#percent_done').html(progress);
};

BOOTH._after_ballot_encryption = function() {
	// if already serialized, use that, otherwise serialize
	BOOTH.encrypted_vote_json = BOOTH.encrypted_ballot_serialized || JSON.stringify(BOOTH.encrypted_ballot.toJSONObject());

	var do_hash = function() {
		BOOTH.encrypted_ballot_hash = b64_sha256(BOOTH.encrypted_vote_json); // BOOTH.encrypted_ballot.get_hash();
		window.setTimeout(show_cast, 0);
	};

	var show_cast = function() {
	    var seal_data = {
			'cast_url': BOOTH.election.cast_url,
			'encrypted_vote_json': BOOTH.encrypted_vote_json,
			'encrypted_vote_hash': BOOTH.encrypted_ballot_hash,
			'election_uuid': BOOTH.election.uuid,
			'election_hash': BOOTH.election_hash,
			'election': BOOTH.election,
			'election_metadata': BOOTH.election_metadata,
			'questions': BOOTH.election.questions,
			'choices': BALLOT.pretty_choices(BOOTH.election, BOOTH.ballot)
		};

		$('#seal_div').html($.render.seal(seal_data));
		BOOTH.show($('#seal_div'));
		BOOTH.encrypted_vote_json = null;
	};

	window.setTimeout(do_hash, 0);
};

BOOTH.total_cycles_waited = 0;

// wait for all workers to be done
BOOTH.wait_for_ciphertexts = function() {
	BOOTH.total_cycles_waited += 1;

	var answers_done = BOOTH.encrypted_answers.filter(ea => ea != null)
	var percentage_done = Math.round((100 * answers_done.length) / BOOTH.encrypted_answers.length);

	if (BOOTH.total_cycles_waited > 250) {
		alert('Parece que houve um problema com o processo de criptografia.\nPor favor, envie um email para sau@tjpr.jus.br e informe que seu processo de criptografia travou em ' + percentage_done + '%');
		return;
	}

	if (percentage_done < 100) {
		setTimeout(BOOTH.wait_for_ciphertexts, 500);
		$('#percent_done').html(percentage_done + '');
		return;
	}

	BOOTH.encrypted_ballot = HELIOS.EncryptedVote.fromEncryptedAnswers(BOOTH.election, BOOTH.encrypted_answers);

	BOOTH._after_ballot_encryption();
};

BOOTH.seal_ballot_raw = function() {
	if (BOOTH.synchronous) {
		BOOTH.progress = new UTILS.PROGRESS();
		var progress_interval = setInterval("BOOTH.check_encryption_status()", 500);
		BOOTH.encrypted_ballot = new HELIOS.EncryptedVote(BOOTH.election, BOOTH.ballot.answers, BOOTH.progress);
		clearInterval(progress_interval);
		BOOTH._after_ballot_encryption();
	} else {
		BOOTH.total_cycles_waited = 0;
		BOOTH.wait_for_ciphertexts();
	}
};

BOOTH.request_ballot_encryption = function() {
	$.post(BOOTH.election_url + "encrypt-ballot", {
		'answers_json': $.toJSON(BOOTH.ballot.answers)
	}, function(result) {
		//BOOTH.encrypted_ballot = HELIOS.EncryptedVote.fromJSONObject($.secureEvalJSON(result), BOOTH.election);
		// rather than deserialize and reserialize, which is inherently slow on browsers
		// that already need to do network requests, just remove the plaintexts

		BOOTH.encrypted_ballot_with_plaintexts_serialized = result;
		var ballot_json_obj = $.secureEvalJSON(BOOTH.encrypted_ballot_with_plaintexts_serialized);
		var answers = ballot_json_obj.answers;
		for (var i = 0; i < answers.length; i++) {
			delete answers[i]['answer'];
			delete answers[i]['randomness'];
		}

		BOOTH.encrypted_ballot_serialized = JSON.stringify(ballot_json_obj);

		window.setTimeout(BOOTH._after_ballot_encryption, 0);
	});
};

BOOTH.seal_ballot = function() {
	BOOTH.show_progress('2');

	// if we don't have the ability to do crypto in the browser,
	// we use the server
	if (!BigInt.in_browser) {
		BOOTH.show_encryption_message_before(BOOTH.request_ballot_encryption, true);
	} else {
		BOOTH.show_encryption_message_before(BOOTH.seal_ballot_raw, true);
		$('#percent_done_container').show();
	}
};

BOOTH.audit_ballot = function() {
	BOOTH.audit_trail = BOOTH.encrypted_ballot_with_plaintexts_serialized || $.toJSON(BOOTH.encrypted_ballot.get_audit_trail());

    BOOTH.show($('#audit_div')).html($.render.audit({'audit_trail': BOOTH.audit_trail, 'election_url': BOOTH.election_url}));
};

BOOTH.post_audited_ballot = function() {
	$.post(BOOTH.election_url + "post-audited-ballot", {
		'audited_ballot': BOOTH.audit_trail
	}, function(result) {
		alert('Esta cédula auditada foi postada na Central de Rastreamento.\nLembre-se, este voto será utilizado apenas com propósitos de auditoria e não será apurado.\nClique em "Voltar para a Votação" e deposite uma nova cédula para ter certeza de que seu voto será contabilizado.');
	});
};

BOOTH.cast_ballot = function() {
	// show progress spinner
//	$('#loading_div').show();
	$('#vote-spinner, #vote-check').toggle();
	$('#proceed_button').attr('disabled', 'disabled');

	// at this point, we delete the plaintexts by resetting the ballot
	BOOTH.setup_ballot(BOOTH.election);

	// clear the plaintext from the encrypted
	if (BOOTH.encrypted_ballot)
		BOOTH.encrypted_ballot.clearPlaintexts();

	BOOTH.encrypted_ballot_serialized = null;
	BOOTH.encrypted_ballot_with_plaintexts_serialized = null;

	// remove audit trail
	BOOTH.audit_trail = null;

	// we're ready to leave the site
	BOOTH.started_p = false;

	// submit the form
	$('#send_ballot_form').submit();
};

BOOTH.show_receipt = function() {
	UTILS.open_window_with_content("Seu rastreador de cédula para " + BOOTH.election.name + ": " + BOOTH.encrypted_ballot_hash);
};

BOOTH.do_done = function() {
	BOOTH.started_p = false;
};