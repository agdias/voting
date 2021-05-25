$(document).ready(function() {
    BigInt.setup(function() {
        $('#verifier_loading').hide();

        if (BigInt.is_dummy) {
            $('#dummy_bigint').show();
            return;
        }

        $('#verifier').show();
        var election_url = $.query.get('election_url');
        $('#election_url').val(election_url);
    }, function() {
        $('#dummy_bigint').show();
    });
});

function result_append(str) {
    $('#results').append(str).append("<br />");
}

function verify_single_ballot(election_url, audit_trail) {
    $('#results').html('');
    var encrypted_vote_json;
    try {
        encrypted_vote_json = jQuery.secureEvalJSON(audit_trail);
    } catch(err) {
        result_append("O texto fornecido não representa uma cédula do sistema.");
        result_append("Por favor, copie novamente a informação de auditoria da cédula e tente novamente.")
        throw err;
    }

    result_append("Carregando eleição...");

    // quick and dirty detection of cast ballot
    if (encrypted_vote_json['cast_at']) {
        result_append("\n\nParece que você está tentando verificar uma cédula depositada. Isso não é possível, somente cédulas auditadas podem ser verificadas.");
        return;
    }

    $('#loading').show();

    var after_computation = function(overall_result) {
        result_append("<br />");

        $('#loading').hide();

        if (overall_result) {
            result_append('VERIFICAÇÃO BEM SUCEDIDA, PRONTO!');
        } else {
            result_append('PROBLEMA - ESTA CÉDULA NÃO PASSOU NA VERIFICAÇÃO.');
        }
    };

    // the hash will be computed within the setup function call now
    $.ajax({
        url: election_url,
        dataType: 'text',
        success: function(raw_json) {
            if (window.Worker) {
                var verifier_worker = new window.Worker("/static/js/verifierworker.js");
                verifier_worker.onmessage = function(event) {
                    if (event.data.type == 'log')
                        return console.log(event.data.msg);

                    if (event.data.type == 'status')
                        return result_append(event.data.msg);

                    if (event.data.type == 'result')
                        return after_computation(event.data.result);
                };

                verifier_worker.postMessage({
                    'type': 'verify',
                    'election': raw_json,
                    'vote': encrypted_vote_json
                });
            } else {
                var overall_result = verify_ballot(raw_json, encrypted_vote_json, result_append);
                after_computation(overall_result);
            }
        },
        error: function() {
            result_append('PROBLEMAS AO CARREGAR a eleição. Tem certeza que está acessando a URL correta?<br />');

            $('#loading').hide();

            result_append('PROBLEMA - ESTA CÉDULA NÃO PASSOU NA VERIFICAÇÃO.');
        }
    });
}