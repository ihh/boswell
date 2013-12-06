{
    var params = []
    var scoreParam = undefined, scoreParamType = undefined
    var anonNonterms = 0
    var lhsStack = []
    var nonterms = []
    var nontermObj = {}
    var undo = {}
    var title = "The Letter"
    var roles = 1

    function extend(a,b) { return LetterWriter.extend(a,b) }

    function addScoreParam(t,p) {
	scoreParam = p;
	scoreParamType = t;
	return true;
    }

    function addParam(p,v,min,max) {
	if (/^not$/i.test(p))
	    throw "You cannot have a parameter called 'not', because 'not' is a reserved keyword. Can you use another parameter name?";
	params.push (new LetterWriter.Param(p,v,min,max))
	return true;
    }

    function pushLhs(sym) { lhsStack.push(sym); nonterms.push(sym); return true }
    function popLhs() { return lhsStack.pop() }
    function currentLhs() { return getNontermObject (lhsStack[lhsStack.length - 1]) }
    function addRule(hint,rhs,props) { currentLhs().addRule(hint,rhs,props); return true }

    function makeAnonId() { return ++anonNonterms; }
    function isAnonId (sym) { return /^[\d]+$/.test(sym) }
    function defaultPrompt (sym) { return isAnonId(sym) ? undefined : (sym.replace(/_/g, ' ')+"?") }
    function defaultStart() { return LetterWriter.defaultStart() }

    function setNontermProperties(nonterm,props) {
	if ("preamble" in props)
	    nonterm.preamble = props.preamble;
	if ("placeholder" in props)
	    nonterm.placeholder = props.placeholder;
	if ("prompt" in props)
	    nonterm.prompt = props.prompt;
	if (("maxUsage" in props) && props.maxUsage > 0)
	    nonterm.maxUsage = props.maxUsage;
	if ("pause" in props)
	    nonterm.pause = props.pause;
	if ("commit" in props)
	    nonterm.commit = props.commit;
	if ("random" in props)
	    nonterm.random = props.random;
	if ("role" in props)
	    nonterm.role = props.role;

	if (nonterm.random) {
	    if (nonterm.commit) {
		console.log ("In @" + nonterm.id + ": can't commit at randomized choices. Clearing 'commit', keeping 'random'")
		nonterm.commit = false
	    }
	    if (nonterm.pause) {
		console.log ("In @" + nonterm.id + ": can't pause at randomized choices. Clearing 'pause', keeping 'random'")
		nonterm.pause = false
	    }
	}

	return true;
    }

    function makeTerm(text) {
	return new LetterWriter.Term(text)
    }

    function getNontermObject(sym) {
	sym = "" + sym;  // force string
	if (!(sym in nontermObj))
	    nontermObj[sym.toLowerCase()] = new LetterWriter.Nonterm(sym,defaultPrompt(sym),isAnonId(sym));
	return nontermObj[sym.toLowerCase()];
    }

    function makeNontermReference(sym,props) {
	return getNontermObject(sym).makeReference(props).sanitizeQualifiers()
    }

    function makeAnonNontermReference(sym,props) {
	var anon = getNontermObject(sym)
	setNontermProperties(anon,props)
	return anon.makeReference({}).sanitizeQualifiers()
    }

    function getStart() {
	var rhsSymbol = {};
	for (var lhs in nontermObj) {
	    for (var i = 0; i < nontermObj[lhs].rules.length; ++i) {
		var rule = nontermObj[lhs].rules[i];
		var rhs = rule.rhs;
		for (var j = 0; j < rhs.length; ++j) {
		    var sym = rhs[j];
		    if (sym instanceof LetterWriter.NontermReference) {
			var id = sym.nonterminal.id;
			rhsSymbol[id] = true;
			// do some qualifier validation, now that all the nonterminal properties have been declared
			sym.sanitizeQualifiers()
		    }
		}
	    }
	}

	for (var sym in rhsSymbol) {
	    if (!nontermObj[sym].rules.length) {
		console.log ("Symbol @" + sym + " is never defined");
	    }
	}

	var notOnRhs = [], candidateStart = [];
	for (var lhs in nontermObj) {
	    if (!(lhs in rhsSymbol) && lhs != defaultStart()) {
		notOnRhs.push (lhs);
		if (!nontermObj[lhs].random)
		    candidateStart.push (lhs)
	    }
	}

	if (notOnRhs.length > 0)
	    console.log ("The following symbols are defined, but never used: " + notOnRhs.map(function(x){return"@"+x}).join(" "));

	var start;
	if (defaultStart() in nontermObj) {
	    if (notOnRhs.length > 0)
		console.log ("However, @" + defaultStart() + " is defined, so we're using that as the root.");
	    start = defaultStart();
	} else if (candidateStart.length) {
	    start = candidateStart[0];
	    if (candidateStart.length == 1)
		console.log ("Of these, @" + start + " makes a natural choice for the start symbol. Use @" + defaultStart() + " to override.");
	    else
		console.log ("The first of these symbols to be defined as a human-played phrase was @" + start + " so we'll use that as the root.");
	} else if (nonterms.length) {
	    start = nonterms[0];
	    console.log ("The first symbol to be defined was @" + start + " so we'll use that as the root.");
	}

	if (nontermObj[start].random) {
	    console.log ("Warning: clearing 'random' property of @" + start + ", because it's the start symbol")
	    nontermObj[start].random = false;
	}

	return nontermObj[start];
    }
}

start
    = spc* statement*  { return { title: title,
				  roles: roles,
				  nonterm: nontermObj,
				  start: getStart(),
				  nonterms: nonterms.map(function(id){return nontermObj[id]}),
				  params: params,
				  scoreParam: scoreParam,
				  scoreParamType: scoreParamType,
				  undo: undo } }

// statement = title_decl / roles_decl / score_param_decl / param_decl / undo / rule
statement = title_decl / roles_decl / score_param_decl / param_decl / undo / rule

score_param_decl
    = "score" spc+ id:bare_param_id spc*  &{ return addScoreParam(id[0],id[1]) }

title_decl
    = "title" spc+ "{" t:text "}" spc* { title = t; }

roles_decl
    = "roles" spc+ n:positive_integer spc* { roles = n; }

undo
    = "undo" spc* "{" spc* "wait" spc* ":" spc* w:nonnegative_numeric_literal spc* "}" spc* { undo.wait = w; }

param_decl
 = "control" spc+ param_list spc*

param_list
    = "$" p:symbol spc* r:param_range spc* v:param_value spc*  &{return addParam(p,v,r[0],r[1])}  ("," spc* param_list)?

param_value
    = "=" spc* v:nonnegative_numeric_literal  { return v }
    / { return 0.5 }

param_range
    = "{" min:text "=>" max:text "}"  { return [min,max] }
    / { return [LetterWriter.defaultNever,LetterWriter.defaultAlways] }

nonterm_symbol
    = "@" s:symbol  { return s.toLowerCase(); }

rule
 = mods:nonterm_modifier* lhs:nonterm_symbol q:sym_modifier* spc* &{return pushLhs(lhs)}
   maxUsage:max_count? "=>" spc* ppp:preamble_placeholder_prompt spc*
    &{return setNontermProperties(currentLhs(),extend(extend(extend((maxUsage?maxUsage:{}),mods.reduce(LetterWriter.extend,{})),q.reduce(LetterWriter.extend,{})),ppp))}
   "{" rhs_list "}" spc* {return popLhs()}

nonterm_modifier
 = "pause" spc*  { return { pause: true } }
 / "commit" spc* { return { commit: true } }
 / "random" spc* { return { random: true } }
 / "#" n:positive_integer spc* { return { role: n.toString() } }
 / "#" r:("+"/"-"/"=") spc* { return { role: r } }

rhs_list
 = rhs ("|" spc* rhs_list)?

rhs
 = hc:hint_with_modifiers symbols:sym_expr* { addRule(hc[0],symbols,hc[1]) }

ui_rhs
 = symbols:sym_expr* { return symbols }

hint_with_modifiers
    = text:hint_text spc* mods:hint_modifier* "=>" { return [text, mods.reduce(LetterWriter.extend,{})] }
    / { return ["", {}] }

hint_text
    = spc* f:param_expr spc* { return f.asText() }
    / text

hint_modifier = times_hidden / max_count

times_hidden
    = "[" spc* "hide" spc+ n:positive_integer spc* "]" spc*  { return {timesHidden:n} }
    / "[" spc* "hide" spc* "once" spc* "]" spc*  { return {timesHidden:1} }
    / "[" spc* "hide" spc* "twice" spc* "]" spc*  { return {timesHidden:2} }
    / "[" spc* "hide" spc* "thrice" spc* "]" spc*  { return {timesHidden:3} }


max_count
    = "[" spc* "use" spc+ n:positive_integer spc* "]" spc*  { return {maxUsage:n} }
    / "[" spc* ("use" spc+)? "once" spc* "]" spc*  { return {maxUsage:1} }
    / "[" spc* ("use" spc+)? "twice" spc* "]" spc*  { return {maxUsage:2} }
    / "[" spc* ("use" spc+)? "thrice" spc* "]" spc*  { return {maxUsage:3} }

positive_integer
 = h:[1-9] t:[0-9]* { t.unshift(h); return parseInt (t.join(""), 10); }

sym_expr
 = ppp:preamble_placeholder_prompt sym:nonterm_symbol q:sym_modifier*
    { return makeNontermReference(sym,extend(ppp,q.reduce(LetterWriter.extend,{}))) }
 / ppp:preamble_placeholder_prompt sym:anonymous_nonterm q:sym_modifier*
    { return makeAnonNontermReference(sym,extend(ppp,q.reduce(LetterWriter.extend,{}))) }
 / param_input
 / param_assignment
 / param_expansion
 / text:text  { return makeTerm(text) }

anonymous_nonterm
 = "{" &{return pushLhs(makeAnonId())} rhs_list "}"  { return popLhs(); }

preamble_placeholder_prompt
 = "[" preamble:text? "|" placeholder:text? "|" prompt:text "]" spc* { return {preamble:preamble, placeholder:placeholder, prompt:prompt}; }
 / "[" placeholder:text? "|" prompt:text "]" spc* { return {placeholder:placeholder, prompt:prompt}; }
 / "[" prompt:text? "]" spc* { return {prompt:prompt}; }
 / { return {}; }

sym_modifier
 = pause_modifier / commit_modifier / random_modifier

pause_modifier
 = ";" { return { pause: true } }

commit_modifier
 = "!" { return { commit: true } }

random_modifier
 = "?" { return { random: true } }

no_modifier
 = { return { } }

optional_pause_modifier
 = pause_modifier / no_modifier

text
 = "\\" escaped:[#\[\]\{\}\|=\@\$] tail:text? { return escaped + tail; }
 / "\\\\" tail:text? { return "\\\\" + tail; }
 / !"=>" "=" tail:text? { return "=" + tail; }
 / !("$" [A-Za-z_#\{]) "$" tail:text? { return "$" + tail; }
 / comment tail:text? { return tail; }
 / head:text_chars tail:text? { return head + tail; }

text_chars
 = chars:[^#\[\]\{\}\|=\@\$]+  { return chars.join(""); }

symbol
  = first:[A-Za-z_] rest:[0-9A-Za-z_]* { return first + rest.join(""); }

spc
  = [ \t\n\r]
  / comment { return ""; }

comment
  = multi_line_comment
  / single_line_comment

multi_line_comment
  = "/*" (!"*/" source_character)* "*/"

single_line_comment
  = "//" (!line_terminator source_character)*

line_terminator
  = [\n\r\u2028\u2029]

source_character
  = .

param_func
    = x:param_identifier  { return new LetterWriter.ParamFunc ({op:x[0],param:x[1].toLowerCase()}) }

param_identifier
    = bare_param_id
    / clothed_param_id

bare_param_id
    = "$#" x:symbol  { return ["$#",x] }
    / "$" x:symbol "[" spc* "$#" spc* "]"  { return ["$#",x] }
    / "$" x:symbol "[" spc* n:positive_integer spc* "]"  { return ["$",x + "[" + n + "]"] }
    / "$" x:symbol  { return ["$",x] }

clothed_param_id
    = "$#{" x:symbol "}"  { return ["$#",x] }
    / "$#{" x:symbol "}" spc* "[" spc* "$#" spc* "]"  { return ["$#",x] }
    / "${" x:symbol "}" spc* "[" spc* n:positive_integer spc* "]"  { return ["$",x + "[" + n + "]"] }
    / "${" x:symbol "}"  { return ["$",x] }

numeric_literal
    = ("+" linespc*)? n:nonnegative_numeric_literal  { return n; }
    / "-" linespc* n:nonnegative_numeric_literal { return -n; }

nonnegative_numeric_literal
 = n:[0-9]+ "%"           { return parseFloat (n.join("")) / 100; }
 / h:[0-9]* "." t:[0-9]+  { return parseFloat (h + "." + t.join("")); }
 / n:[0-9]+               { return parseFloat (n.join("")); }

linespc
 = [ \t]
 / multi_line_comment




// Used within RHS of rules
param_input
    = id:param_identifier linespc* "@=?" mods:optional_pause_modifier
{ return new LetterWriter.ParamInput ({type:id[0],id:id[1].toLowerCase(),local:true,mods:mods}) }
    / id:param_identifier linespc* "=?" mods:optional_pause_modifier
{ return new LetterWriter.ParamInput ({type:id[0],id:id[1].toLowerCase(),local:false,mods:mods}) }

param_assignment
    = id:param_identifier linespc* "@=" linespc* expr:param_expr param_terminator
{ return new LetterWriter.ParamAssignment ({type:id[0],id:id[1].toLowerCase(),value:expr,local:true}) }
    / id:param_identifier linespc* "=" linespc* expr:param_expr param_terminator
{ return new LetterWriter.ParamAssignment ({type:id[0],id:id[1].toLowerCase(),value:expr,local:false}) }
    / id:param_identifier linespc* op:cumulative_op "=" linespc* increment_expr:param_expr param_terminator
{ var param_func = new LetterWriter.ParamFunc ({op:id[0],param:id[1].toLowerCase()})
  var rhs_expr = new LetterWriter.ParamFunc ({l:param_func,r:increment_expr,op:op})
  return new LetterWriter.ParamAssignment ({type:id[0],id:id[1].toLowerCase(),value:rhs_expr,local:false}) }
    / id:param_identifier linespc* "++" linespc* param_terminator
{ var param_func = new LetterWriter.ParamFunc ({op:id[0],param:id[1].toLowerCase()})
  var increment_expr = new LetterWriter.ParamFunc ({op:"#",value:1})
  var rhs_expr = new LetterWriter.ParamFunc ({l:param_func,r:increment_expr,op:"+"})
  return new LetterWriter.ParamAssignment ({type:id[0],id:id[1].toLowerCase(),value:rhs_expr,local:false}) }
    / id:param_identifier linespc* "--" linespc* param_terminator
{ var param_func = new LetterWriter.ParamFunc ({op:id[0],param:id[1].toLowerCase()})
  var increment_expr = new LetterWriter.ParamFunc ({op:"#",value:1})
  var rhs_expr = new LetterWriter.ParamFunc ({l:param_func,r:increment_expr,op:"-"})
  return new LetterWriter.ParamAssignment ({type:id[0],id:id[1].toLowerCase(),value:rhs_expr,local:false}) }

cumulative_op = "+" / "-" / "/" / "*"

param_terminator = line_terminator / ";" / !source_character

param_expansion
    = id:clothed_param_id
{ return new LetterWriter.ParamReference (id[0], id[1]) }
    / id:bare_param_id (param_terminator / &(linespc* !(linespc / "=")))
{ return new LetterWriter.ParamReference (id[0], id[1]) }


param_expr
    = l:sum_expr linespc* op:"." linespc* r:param_expr
{ return new LetterWriter.ParamFunc ({l:l,r:r,op:op}) }
    / sum_expr

sum_expr
    = l:product_expr linespc* op:("+"/"||"/"or"i/"-") linespc* r:sum_expr
{ return new LetterWriter.ParamFunc ({l:l,r:r,op:op}) }
  / product_expr

product_expr
    = l:relation_expr linespc* op:("*"/"&&"/"and"i/"/"/"vs"i) linespc* r:product_expr
{ return new LetterWriter.ParamFunc ({l:l,r:r,op:op}) }
    / "!" linespc* l:product_expr
{ return new LetterWriter.ParamFunc ({op:"!",l:l}) }
  / relation_expr

relation_expr
    = l:equality_expr linespc* op:("<"/"<="/">"/">=") linespc* r:relation_expr
{ return new LetterWriter.ParamFunc ({l:l,r:r,op:op}) }
  / equality_expr

equality_expr
    = l:primary_expr linespc* op:("!="/"==") linespc* r:relation_expr
{ return new LetterWriter.ParamFunc ({l:l,r:r,op:op}) }
  / primary_expr

primary_expr
    = n:numeric_literal  { return new LetterWriter.ParamFunc ({op:"#",value:n}) }
    / s:string_literal  { return new LetterWriter.ParamFunc ({op:"'",value:s}) }
    / param_func
    / "(" linespc* e:sum_expr linespc* ")"  { return e; }

string_literal
    = "\"" s:double_quoted_text? "\"" { return s }
    / "'" s:single_quoted_text? "'" { return s }

double_quoted_text
    = "\\\\" tail:double_quoted_text? { return "\\" + tail; }
    / "\\" escaped:["] tail:double_quoted_text? { return escaped + tail; }
    / chars:[^"]+ tail:double_quoted_text? { return chars.join("") + tail; }

single_quoted_text
    = "\\\\" tail:single_quoted_text? { return "\\" + tail; }
    / "\\" escaped:['] tail:single_quoted_text? { return escaped + tail; }
    / chars:[^']+ tail:single_quoted_text? { return chars.join("") + tail; }
