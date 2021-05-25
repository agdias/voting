$(document).ready(function() {
	$.get('/static/templates/question.html', function(data) {
		$.templates('question', data);
	});
	$.get('/static/templates/answer.html', function(data) {
		$.templates('answer', data);
	});

	$.get('/static/templates/questions.html', function(data) {
		$.templates('questions', data);
		refresh();
	});
});

function refresh() {
	$('#question').html('');
	$('#questions').html($.render.questions({questions: QUESTIONS}, {admin: ADMIN_P})).show();
}

function get_question() {
	var form = $('#form_question');

	var new_q = {
		'question': form.find('#question_name').val(),
		'min': parseInt(form.find('#min').val()),
		'max': (form.find('#max').val() == '') ? null : parseInt(form.find('#max').val()),
		'short_name': form.find('#question_name').val(),
		'answers': [],
		'answer_urls': [],
		'choice_type': 'approval',
		'tally_type': 'homomorphic',
		'result_type': form.find('#result_type').val()
	};

	/* carrega as respostas */
	form.find('div.answer').each(function() {
		var div = $(this);
		if (div.find('.answer_text').val() == '') {
			return true;
		}
		new_q.answers.push(div.find('.answer_text').val());
		new_q.answer_urls.push(div.find('.answer_url').val());
	});

	if (new_q.answers.length == 0) {
		return null;
	}

	return new_q;
}

function question_save() {
	var new_question = get_question();
	if (new_question == null) {
		alert('É preciso incluir ao menos uma opção.')
		return;
	}

	var form = $('#form_question');
	var position = form.find('#question_number').val()
	if (position == "") {
		QUESTIONS.push(new_question);
	} else {
		QUESTIONS[parseInt(position)] = new_question;
	}
	save_questions(refresh);
}

function question_new() {
	$('#questions').hide();
	$('#question').html($.render.question({}, {first_answer: 0}));
	add_answers(DEFAULT_NUM_ANSWERS);
}

function question_edit(q_num) {
	$('#questions').hide();

	var question_data = QUESTIONS[q_num];
	$('#question').html($.render.question(question_data, {first_answer: 0, question_number: q_num}));
	$('#min').val(question_data.min);
	$('#max').val(question_data.max);
	$('#result_type').val(question_data.result_type);
}

function question_edit_cancel() {
	$('#questions').show();
	$('#question').html('');
}

function add_answers(num) {
	for (var i = 0; i < num; i++)
	{
		add_answer();
	}
}

function add_answer() {
	data = {
		"answers": [""],
		"answer_urls": [""]
	};
	$('#answers').append($.render.answer(data, {first_answer: $('div.answer').length}));
}

function save_questions(callback) {
	$.post('./save_questions', {
		'questions_json': $.toJSON(QUESTIONS),
		'csrf_token': CSRF_TOKEN
	}, function(result) {
		if (result == "FAILURE") {
			alert("A questão não pode ser salva. Por favor, verifique se as URLs que você informou começam com http:// ou https://");
		} else {
			callback();
		}
	});
}

function question_remove(q_num) {
	QUESTIONS.splice(q_num, 1);
	save_questions(refresh);
}

function question_move_up(num) {
	[QUESTIONS[num], QUESTIONS[num - 1]] = [QUESTIONS[num - 1], QUESTIONS[num]]
	save_questions(refresh);
}