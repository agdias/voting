/*
 * JavaScript HTML 5 Worker for BOOTH
 */

// import needed resources
importScripts(
    "/static/js/jscrypto/jsbn.js",
    "/static/js/jscrypto/jsbn2.js",
    "/static/js/jscrypto/sjcl.js",
    "/static/js/jscrypto/class.js",
    "/static/js/jscrypto/bigint.js",
    "/static/js/jscrypto/random.js",
    "/static/js/jscrypto/elgamal.js",
    "/static/js/jscrypto/sha1.js",
    "/static/js/jscrypto/sha2.js",
    "/static/js/jscrypto/helios.js",
    "/static/js/verifier.js"
);

var console = {
    'log' : function(msg) {
	self.postMessage({'type':'log','msg':msg});
    }
};

var status_update = function(msg) {
    self.postMessage({'type' : 'status', 'msg' : msg});
};

var ELECTION = null;
var VOTE = null;

function do_verify(message) {
    console.log("verifying!");

    // json string
    ELECTION = message.election;

    // json object
    VOTE = message.vote;

    var result = verify_ballot(ELECTION, VOTE, status_update);

    // send the result back
    self.postMessage({
	    'type': 'result',
		'result': result});
}

// receive either
// a) an election and an integer position of the question
// that this worker will be used to encrypt
// {'type': 'setup', 'question_num' : 2, 'election' : election_json}
//
// b) an answer that needs encrypting
// {'type': 'encrypt', 'answer' : answer_json}
//
self.onmessage = function(event) {
    // dispatch to method
    self['do_' + event.data.type](event.data);
}
