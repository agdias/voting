var CURRENT_SECTION = null;

$(document).ready(function() {
    BigInt.setup(function() {
        $('#verifier_loading').hide();
        $('#verifier').show();
    }, function() {
        alert('desculpe-nos, a verificação no navegador requer suporte a Java.');
    });
});

function load_ballots(election_url, ballot_list, ballots, final_callback) {
    // the ballots array is the place where we build up the list of ballots

    // end of the iteration?
    if (ballot_list.length == ballots.length) {
        final_callback(ballots);
        return;
    }

    result_append("carregando cédula para o eleitor #" + (ballots.length + 1));

    // get the next ballot
    $.get(election_url + "ballots/" + ballot_list[ballots.length].uuid + '/last', function(new_ballot) {
        ballots.push(new_ballot);
        if (new_ballot.vote == null)
            result_append("nenhuma cédula para esse eleitor #" + ballots.length);
        else
            result_append("cédula ENCONTRADA para o eleitor #" + ballots.length);
        load_ballots(election_url, ballot_list, ballots, final_callback);
    });
}

// load the ballot list in increments of 50, for long ballots
function load_ballot_list(election_url, ballot_list, after, final_callback) {
    var url = election_url + "voters/?limit=50";
    if (after)
        url += "&after=" + after;

    $.get(url, function(new_ballot_list) {
        // done, no more ballots?
        if (new_ballot_list.length == 0)
            return final_callback(ballot_list);

        // not done, add to the list
        ballot_list = ballot_list.concat(new_ballot_list);
        after = ballot_list[ballot_list.length - 1].uuid;

        // and iterate
        load_ballot_list(election_url, ballot_list, after, final_callback);
    });
}

function pretty_result(result) {
    return result ? fa_icon('check', 'green') : fa_icon('times', 'red');
}

function result_append(str, class_name = null) {
//    $('#results').append(str).append("<br />");
    var text = $('<span/>').html(str).css('display', 'block');
    if (class_name != null) {
        text.addClass(class_name);
    }
    CURRENT_SECTION.append(text);
//    CURRENT_SECTION.append(str).append("\n");
}

function fa_icon(icon, color = null) {
    var output = $('<span/>').addClass('fas fa-fw').addClass("fa-" + icon);
    if (color != null) {
        output.css('color', color);
    }
    return output[0].outerHTML;
}

function new_section(section_name) {
    var section = $('<div/>').addClass('card mt-3').append($('<div/>').addClass('card-header h3').text(section_name));
    CURRENT_SECTION = $("<code/>");
//    var content = $('<div/>').append($("<pre/>").append($("<code/>").text('xxxxx\nxxxxx<br>0123')));
    var content = $('<div/>').append($("<pre/>").append(CURRENT_SECTION));
    section.append(content);
    $('#results').append(section);
    return content;
}

function load_election_and_ballots(election_url) {
    new_section('Eleição');
    result_append("carregando eleição...");
//    result_append("carregando eleição..." + fa_icon('check', 'green'));
//    result_append("carregando eleição..." + fa_icon('times', 'red'));
//    return;

    var overall_result = true;

    // the hash will be computed within the setup function call now
    $.get(election_url, {}, function(raw_json) {
        try {
            election = HELIOS.Election.fromJSONString(raw_json);
            result_append("eleição carregada: " + election.name);
            result_append("código de identificação da eleição: " + election.get_hash());

            var tally = [];

            $(election.questions).each(function(qnum, q) {
                if (q.tally_type != "homomorphic") {
                    result_append("PROBLEMA: esta eleição não é uma eleição de apuração homomórfica direta. Portanto,o Helios não pode verificá-la.");
                    return;
                }

                tally[qnum] = $(q.answers).map(function(anum, a) {
                    return 1;
                });
            });

            result_append("carregando lista de eleitores...");
            // load voter list
            load_ballot_list(election_url, [], null, function(ballot_list) {
                result_append("lista de eleitores carregada, agora carregando a cédula de cada um..");

                // load all ballots
                load_ballots(election_url, ballot_list, [], function(ballots) {
                    new_section('Cédulas');
                    // now load each ballot
                    $(ballots).each(function(i, cast_vote) {

                        if (cast_vote.vote == null)
                            return;

                        var vote = HELIOS.EncryptedVote.fromJSONObject(cast_vote.vote, election);
//                        result_append("Eleitor #" + (i + 1));
                        result_append("Eleitor #" + (i + 1), 'font-weight-bold');
                        result_append("UUID: " + cast_vote.voter_uuid, 'ml-2');
                        result_append("Número de Rastreamento da Cédula: " + vote.get_hash(), 'ml-2');

                        vote.verifyProofs(election.public_key, function(answer_num, choice_num, result, choice) {
                            overall_result = overall_result && result;
                            if (choice_num != null) {
                                // keep track of tally
                                tally[answer_num][choice_num] = choice.multiply(tally[answer_num][choice_num]);

                                result_append("Questão #" + (answer_num + 1) + ", Opção #" + (choice_num + 1) + " " + pretty_result(result), 'ml-2');
                            } else {
                                result_append("Questão #" + (answer_num + 1) + " GLOBAL " + pretty_result(result), 'ml-2');
                            }
                        });

                        result_append(" ");
                    });

                    // get the election result
                    $.get(election_url + "result", function(results) {

                        // get the trustees and proofs
                        $.get(election_url + "trustees/", function(trustees) {

                            // create the Helios objects
                            trustees = $(trustees).map(function(i, trustee) {
                                var x = HELIOS.Trustee.fromJSONObject(trustee);
                                x.name = trustee.name;
                                return x;
                            });

                            // the public key that we'll check
                            var combined_key = 1;

                            new_section('Integrantes da Comissão Eleitoral');
                            // verify the keys
                            $(trustees).each(function(i, trustee) {
                                result_append("Integrante #" + (i + 1) + ": " + trustee.name, 'font-weight-bold');
                                console.log(trustee);
                                if (trustee.public_key.verifyKnowledgeOfSecretKey(trustee.pok, ElGamal.fiatshamir_dlog_challenge_generator)) {
                                    result_append("PK " + trustee.public_key_hash + " " + pretty_result(true), 'ml-2');

                                    // FIXME check the public key hash
                                } else {
                                    result_append("ERRO de chave do integrante da Comissão Eleitoral " + trustee.name + " " + pretty_result(false), 'ml-2');
                                    overall_result = false;
                                }

                                combined_key = trustee.public_key.multiply(combined_key);

                                result_append(" ");
                            });

                            // verify the combination of the keys into the final public key
                            if (combined_key.equals(election.public_key)) {
                                result_append("Chave pública da eleição CORRETAMENTE FORMADA " + pretty_result(true));
                            } else {
                                result_append("ERRO, a chave pública da eleição não confere " + pretty_result(false));
                                overall_result = false;
                            }

                            new_section("Apuração");

                            $(tally).each(function(q_num, q) {
                                result_append("Questão #" + (q_num + 1) + ": " + election.questions[q_num].short_name, 'font-weight-bold');
                                $(q).each(function(a_num, a) {
                                    var plaintext = new ElGamal.Plaintext(election.public_key.g.modPow(BigInt.fromInt(results[q_num][a_num]), election.public_key.p), election.public_key);

                                    var check = true;
                                    result_append("Opção #" + (a_num + 1) + ": " + election.questions[q_num].answers[a_num] + " - CONTAGEM = " + results[q_num][a_num], 'ml-2');

                                    var decryption_factors = [];

                                    // go through the trustees' decryption factors and verify each one
                                    $(trustees).each(function(t_num, trustee) {
                                        if (trustee.public_key.verifyDecryptionFactor(a, trustee.decryption_factors[q_num][a_num],
                                                trustee.decryption_proofs[q_num][a_num], ElGamal.fiatshamir_challenge_generator)) {
                                            result_append("Integrante da Comissão Eleitoral " + trustee.name + ": fator de decifragem confere " + pretty_result(true), 'ml-3');
                                        } else {
                                            result_append("ERRO com o integrante da Comissão Eleitoral " + trustee.name + ": o fator de decifragem não confere " + pretty_result(false), 'ml-3');
                                            check = false;
                                            overall_result = false;
                                        }

                                        decryption_factors.push(trustee.decryption_factors[q_num][a_num]);
                                    });

                                    // recheck decryption factors
                                    var expected_value = election.public_key.g.modPow(BigInt.fromInt(results[q_num][a_num]), election.public_key.p);
                                    var recomputed_value = a.decrypt(decryption_factors).getM();
                                    if (expected_value.equals(recomputed_value)) {} else {
                                        check = false;
                                        overall_result = false;
                                    }

                                    result_append("GLOBAL Questão #" + (q_num + 1) + ", Opção #" + (a_num + 1) + " " + pretty_result(check), 'ml-3 mb-2');
                                });

                            });

                            new_section('RESULTADO FINAL');

                            if (overall_result) {
                                result_append("ELEIÇÃO COMPLETAMENTE VERIFICADA - SUCESSO " + pretty_result(overall_result), 'font-weight-bold');
                            } else {
                                result_append("FALHA NA VERIFICAÇÃO" + pretty_result(overall_result), 'font-weight-bold');
                            }
                        });
                    });
                });
            });
        } catch (error) {
            result_append('<p>ATENÇÃO: Esta eleição é privada.</p>');
            result_append('<p>Acesse como eleitor ou como gestor da eleição para realizar esta operação.</p>');
            result_append('<a class="btn btn-primary" href="' + election_url + '">Conectar como eleitor </a>');
            result_append('<a class="btn btn-primary" href="/">Conectar como gestor</a>');
        }
    }, 'text'); // end get

}

$(document).ready(function() {
    var election_url = $.query.get('election_url');
    $('#election_url').val(election_url);
});