$(document).ready(function() {
    $('#result_div').hide();
    $('#waiting_div').hide();
    $('#waiting_submit_div').hide();
    $('#done_div').hide();
    $('#error_div').hide();
    bind_secret_key_file();

    BigInt.setup(function() {
        ELECTION_PK = ElGamal.PublicKey.fromJSONObject(ELECTION_JSON['public_key']);
        TALLY = HELIOS.Tally.fromJSONObject(TALLY_JSON, ELECTION_PK);
        $('#sk_section').show();
    });
});

function bind_secret_key_file() {
    $('#secret_key_file').change(function() {
        var fr = new FileReader();
        fr.onload = function() {
            if (!check_key(fr.result)) {
                $('#valid-file').hide();
                $('#invalid-file').show();
                $('#sk_textarea').val('');
                return;
            }
            $('#valid-file').show();
            $('#invalid-file').hide();
            $('#sk_textarea').val(fr.result);
        }

        fr.readAsText(this.files[0]);
    });
}

function show_secret_key_content() {
    $('#key-by-content').show();
}

function decrypt_and_prove_tally(tally, public_key, secret_key) {
    // we need to keep track of the values of g^{voter_num} for decryption
    var DISCRETE_LOGS = {};
    var CURRENT_EXP = 0;
    var CURRENT_RESULT = BigInt.ONE;
    DISCRETE_LOGS[CURRENT_RESULT.toString()] = CURRENT_EXP;

    // go through the num_tallied
    while (CURRENT_EXP < tally.num_tallied) {
        CURRENT_EXP += 1;
        CURRENT_RESULT = CURRENT_RESULT.multiply(public_key.g).mod(public_key.p);
        DISCRETE_LOGS[CURRENT_RESULT.toString()] = CURRENT_EXP;
    }

    // initialize the arrays
    var decryption_factors= [];
    var decryption_proofs= [];

    // decrypt the tallies
    (tally.tally).forEach(function(q_tally,q_num) {
        document.getElementsByClassName(tally.tally)
            decryption_factors[q_num] = [];
            decryption_proofs[q_num] = [];

            (q_tally).forEach(function(choice_tally, choice_num) {
                 var one_choice_result = secret_key.decryptionFactorAndProof(choice_tally, ElGamal.fiatshamir_challenge_generator);

                 decryption_factors[q_num][choice_num] = one_choice_result.decryption_factor
                 decryption_proofs[q_num][choice_num] = one_choice_result.decryption_proof;
            });
    });

    return {'decryption_factors': decryption_factors, 'decryption_proofs' : decryption_proofs};
}

function get_secret_key() {
    return ElGamal.SecretKey.fromJSONObject(JSON.parse($('#sk_textarea').val()));
}

function do_tally() {
    if (!check_key($('#sk_textarea').val())) {
        alert('A chave informada não é válida. Por favor, tente novamente.')
        return;
    }

    $('#sk_section').hide();
    $('#waiting_div').show();

    var secret_key = get_secret_key();

    var factors_and_proof = decrypt_and_prove_tally(TALLY, ELECTION_PK, secret_key);

    // json'ify it
    var factors = factors_and_proof.decryption_factors
    var decryption_proofs = $(factors_and_proof.decryption_proofs).map(function(i, q_proof) {
        return $(q_proof).map(function(j, a_proof){
            return a_proof.toJSONObject();
        });
    });

    var factors_and_proofs = {'decryption_factors': factors, 'decryption_proofs': decryption_proofs};
    var factors_and_proofs_json = $.toJSON(factors_and_proofs);

    // clear stuff
    secret_key = null;
    $('#sk_textarea').val("");

    // display the result in a text area.
    $('#waiting_div').hide();

    $('#result_textarea').html(factors_and_proofs_json);
    $('#result_div').show();
    $('#first-step-success').show();
}

function submit_result() {
    $('#result_div').hide();
    $('#waiting_submit_div').show();

    var result = $('#result_textarea').val();

    // do the post
    $.ajax({
         type: 'POST',
         url: "./upload-decryption",
         data: {'factors_and_proofs': result},
         success: function(result) {
             $('#waiting_submit_div').hide();
             if (result != "FAILURE") {
                 $('#done_div').show();
             } else {
                 alert('A verificação falhou, provavelmente você está com a chave errada.');
                 reset();
             }
         },
         error: function(error) {
             $('#waiting_submit_div').hide();
             $('#error_div').show();
         }
    });
}

function skip_to_second_step() {
    $('#sk_section').hide();
    $('#result_div').show();
    $('#result_textarea').html('');
    $('#skip_to_second_step_instructions').hide();
}

function reset() {
    $('#result_div').hide();
    $('#skip_to_second_step_instructions').show();
    $('#sk_section').show();
    $('#result_textarea').html('');
    $('#first-step-success').hide();
    $('#valid-file').hide();
    $('#invalid-file').hide();
}