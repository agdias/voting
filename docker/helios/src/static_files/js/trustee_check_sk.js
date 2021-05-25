$(document).ready(function() {
    reset();
    bind_secret_key_file();
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

function reset() {
    $('#processing').hide();
    $('#result').html("");
    $('#input').hide();
    $('#loading').show();
    BigInt.setup(function() {
        $('#loading').hide();
        $('#input').show();
    });
    $('#key-by-content').hide();
    $('#sk_textarea').val('');
    $('#reset_link').hide();
    $('#valid-file').hide();
    $('#invalid-file').hide();
}

function check_sk() {
    var sk_value = $('#sk_textarea').val();
    $('#input').hide();
    $('#processing').show();

    try {
        var secret_key = ElGamal.SecretKey.fromJSONObject(jQuery.secureEvalJSON(sk_value));

        var pk_hash = b64_sha256(jQuery.toJSON(secret_key.pk));
        var key_ok_p = (pk_hash == PK_HASH);
    } catch (e) {
        debugger;
        var key_ok_p = false;
    }

    $('#processing').hide();

    var reset_link = '<br />';
    if (key_ok_p) {
        $('#result').html('<span class="fas fa-fw fa-check text-success"></span> A sua chave secreta confere!')
    } else {
        $('#result').html('<span class="fas fa-fw fa-times text-danger"></span> A sua chave não confere.')
        $('#reset_link').show();
    }
    $('#sk_textarea').val('');
}