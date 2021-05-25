var PUBLIC_KEY, PROOF;

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

function cancel_reuse() {
    $('#generator').show();
    $('#reuse').hide();
}

function clear_keys() {
    $('#pk_content').hide();
    $('#pk_link').hide();
    $('#sk_download').hide();
    $('#pk_form').hide();
    $('#generator').show();
    $('#clear_button').hide();
    $('#reuse').hide();
}

function show_key_reuse() {
    $('#generator').hide();
    $('#key-by-content').hide();
    $('#reuse').show();
}

SECRET_KEY = null;

function reuse_key() {
    var secret_key_text = $('#sk_textarea').val();
    if (!check_key(secret_key_text)) {
        alert('A chave informada não é válida. Por favor, tente novamente.')
        return;
    }

    SECRET_KEY = ElGamal.SecretKey.fromJSONObject(jQuery.secureEvalJSON(secret_key_text));

    $('#reuse').hide();
    setup_public_key_and_proof();
    show_pk();
}

// start collecting some local randomness
sjcl.random.startCollectors();

$(document).ready(function() {
    clear_keys();
    $('#generator').hide();
    bind_secret_key_file();

    // get some more server-side randomness for keygen
    $.getJSON('../../get_randomness', function(result) {
       sjcl.random.addEntropy(result.randomness);
       BigInt.setup(function() {
          ELGAMAL_PARAMS = ElGamal.Params.fromJSONObject(ELGAMAL_PARAMS_JSON);
          $('#waiting_message').hide();
          $('#generator').show();
       });
    });
});


function generate_keypair() {
    $('#generator').hide();

    try {
        SECRET_KEY = ELGAMAL_PARAMS.generate();
    } catch (e) {
        alert(e);
    }

    setup_public_key_and_proof();
}

function setup_public_key_and_proof() {
    // generate PoK of secret key
    PROOF = SECRET_KEY.proveKnowledge(ElGamal.fiatshamir_dlog_challenge_generator);
    PUBLIC_KEY = SECRET_KEY.pk;

    var pk_val = jQuery.toJSON({'pok': PROOF, 'public_key': PUBLIC_KEY});
    $('#pk_textarea').val(pk_val);
    $('#pk_hash').html(b64_sha256(jQuery.toJSON(PUBLIC_KEY)));

    $('#clear_button').show();
    show_sk();
}

function show_sk() {
    $('#sk_download').show();
    $('#show_key').show();
}

function download_sk() {
    $('#show_key').hide();
    $('#pk_content').show();
    $('#sk_content').html(jQuery.toJSON(SECRET_KEY));
}

function download_sk_to_file(filename) {
    var blob = new Blob([jQuery.toJSON(SECRET_KEY)], {type: "text/plain;charset=utf-8"});
    saveAs(blob, filename);
    window.setTimeout(function() {
        $('#pk_link').show();
    }, 2000);
}

function show_pk() {
    $('#pk_link').hide();
    $('#sk_download').hide();
    $('#pk_content').hide();
    $('#pk_hash').show();
    $('#pk_form').show();
}