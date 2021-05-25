// helper functions for verifying a ballot
// assumes all of Helios machinery is loaded

function verify_ballot(election_raw_json, encrypted_vote_json, status_cb) {
	var overall_result = true;
	try {
		election = HELIOS.Election.fromJSONString(election_raw_json);
		var election_hash = election.get_hash();
		status_cb("Código de identificação da eleição é " + election_hash);

		// display ballot fingerprint
		encrypted_vote = HELIOS.EncryptedVote.fromJSONObject(encrypted_vote_json, election);
		status_cb("Rastreador da cédula é " + encrypted_vote.get_hash());

		// check the hash
		if (election_hash == encrypted_vote.election_hash) {
			status_cb("Código de identificação da eleição na cédula confere");
		} else {
			overall_result = false;
			status_cb("PROBLEMA = o código de identificação da eleição não confere");
		}

		// display the ballot as it is claimed to be
		status_cb("Conteúdo da cédula:");
		election.questions.forEach(function(q, qnum) {
			if (q.tally_type != "homomorphic") {
				status_cb("AVISO: o tipo de apuração para está questão não é homomórfica. A verificação pode falhar porque este verificador é configurado para trabalhar com cédulas homomórficas..");
			}

			var answer_pretty_list = encrypted_vote.encrypted_answers[qnum].answer.map(function(aindex, anum) {
				return q.answers[aindex];
			});
			status_cb("  Questão #" + (qnum + 1) + " - " + q.short_name + " : " + answer_pretty_list.join(", "));
		});

		// verify the encryption
		if (encrypted_vote.verifyEncryption(election.questions, election.public_key)) {
			status_cb("Criptografia verificada.");
		} else {
			overall_result = false;
			status_cb("PROBLEMA = A criptografia não confere.");
		}

		// verify the proofs
		if (encrypted_vote.verifyProofs(election.public_key, function(ea_num, choice_num, result) {})) {
			status_cb("Provas ok.");
		} else {
			overall_result = false;
			status_cb("PROBLEMA = As provas não funcionam.");
		}
	} catch (e) {
		status_cb('Problema ao analisar a estrutura da eleição ou da cédula, entrada mal-formada: ' + e.toString());
		overall_result = false;
	}

	return overall_result;
}