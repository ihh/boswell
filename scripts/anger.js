var state = ["ok", "angry", "enraged", "violent", "covert", "isolated", "resentful", "contesting"]

var trans
    = {"ok": { "Insult": "angry" },
       "angry": { "Seethe": "angry", "Retaliate": "enraged", "Challenge": "contesting",
		  "Stall": "resentful", "Reconcile": "ok" },
       "enraged": { "Seethe": "enraged", "Retaliate": "violent", "Deescalate": "angry" },
       "violent": { "Seethe": "violent", "Deescalate": "enraged" },
       "contesting": { "Declined": "angry", "Won": "ok", "Lost": "resentful" },
       "resentful": { "Resign": "resentful", "Reconcile": "ok", "Retaliate": "angry",
		      "Passive": "covert", "Shunned": "isolated" },
       "covert": { "Snipe": "covert", "Shun": "isolated", "Vent": "angry" },
       "isolated": { "Stall": "isolated", "Peace": "resentful"} }

var player = ['Montresor', 'Fortunato'];

var verbText
    = {"Insult": '$self insults $other',
       "Seethe": '$self seethes',
       "Retaliate": '$self retaliates against $other',
       "Challenge": '$self challenges $other',
       "Stall": '$self stalls',
       "Reconcile": '$self attempts reconciliation with $other',
       "Seethe": '$self seethes',
       "Deescalate": '$self de-escalates',
       "Declined": '$self feels ignored by $other',
       "Won": '$self crows victory over $other',
       "Lost": '$self feels humiliated by $other',
       "Resign": '$self feels resigned',
       "Passive": '$self is passive-aggressive towards $other',
       "Shunned": '$self feels shunned',
       "Snipe": '$self snipes at $other',
       "Shun": '$self shuns $other',
       "Vent": '$self vents at $other',
       "Peace": '$self makes a peace offering'}

var nounText = {}
for (var i = 0; i < state.length; ++i)
    nounText[state[i]] = state[i]
nounText['covert'] = 'covertly violent'
nounText['violent'] = 'overtly violent'
nounText['contesting'] = 'argumentative'

function state_nonterm(state1,state2,player) {
    return player == 1 ? ("@"+state1+"1_"+state2+"2") : ("@"+state2+"2_"+state1+"1")
}

function verb_nonterm(verb,player) {
    return "@"+verb.toLowerCase()+player
}

function noun_nonterm(noun,player) {
    return "@"+noun.toLowerCase()+player
}

function make_noun(n,playerNum) {
    return replace_self_other ('$self is ' + nounText[n] + '.', playerNum)
}

function make_verb(v,playerNum) {
    return replace_self_other (verbText[v] + '.', playerNum)
}

function replace_self_other(text,playerNum) {
    --playerNum
    var self = player[playerNum]
    var other = player[1 - playerNum]
    return text.replace(/\$self/g,self).replace(/\$other/g,other)
}

var p = []
for (var i = 0; i < state.length; ++i) {
    var src = state[i]
    for (var j = 0; j < state.length; ++j) {
	var other = state[j]
	var opts = trans[src]
	var rhs1 = [], rhs2 = []
	for (var verb in opts) {
	    var dest = opts[verb]
	    rhs1.push ([verb,"=>",verb_nonterm(verb,1),noun_nonterm(dest,2),state_nonterm(dest,other,2)].join(" "))
	    rhs2.push ([verb,"=>",verb_nonterm(verb,2),noun_nonterm(dest,1),state_nonterm(dest,other,1)].join(" "))
	}
	p.push ("#1 " + state_nonterm(src,other,1) + " => [Your move, " + player[0] + "?]{" + rhs1.join(" | ") + "}\n")
	p.push ("#2 " + state_nonterm(other,src,2) + " => [Your move, " + player[1] + "?]{" + rhs2.join(" | ") + "}\n")
    }
}

for (var verb in verbText) {
    p.push ("#1 random " + verb_nonterm(verb,1) + " => {" + make_verb(verb,1) + "\n}\n")
    p.push ("#2 random " + verb_nonterm(verb,2) + " => {" + make_verb(verb,2) + "\n}\n")
}

for (var noun in nounText) {
    p.push ("#1 random " + noun_nonterm(noun,1) + " => {" + make_noun(noun,1) + "\n}\n")
    p.push ("#2 random " + noun_nonterm(noun,2) + " => {" + make_noun(noun,2) + "\n}\n")
}

var s = state[0]
var start = state_nonterm(s,1)

console.log ("roles 2\n")
console.log ("\@start => { " + noun_nonterm(s,1) + " " + noun_nonterm(s,2) + " " + start + " }\n")
console.log (p.join(""))
