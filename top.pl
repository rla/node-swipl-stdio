:- set_stream(user_input, tty(false)).
:- set_stream(user_input, encoding(utf8)).
:- set_stream(user_output, tty(false)).
:- set_stream(user_output, encoding(utf8)).

:- use_module(library(http/json)).
:- use_module(library(debug)).

:- debug(node).

% Toplevel executor. Implemented as a
% failure-driven loop. Redirects stream
% from user_output to stderr.

loop:-
    current_output(Out),
    set_stream(user_error, alias(user_output)),
    set_output(user_error),
    repeat,
    catch(read_execute_query(Out), Error, true),
    (   var(Error)
    ->  true
    ;   export_error(Out, Error)),
    fail.

read_execute_query(Out):-
    (   at_end_of_stream(user_input)
    ->  halt(0)
    ;   read_line_to_string(user_input, String),
        debug(node, 'got input: ~w', [String]),
        atom_json_dict(String, Dict, []), !,
        (   execute_query(Out, Dict.query)
        ;   export_failure(Out) )).

% Executes the given query. Reports solutions
% through a failure-driven loop which is conditionally
% cut once the user requests to close the query.

execute_query(Out, Query):-
    debug(node, 'executing query: ~w', [Query]),
    atom_to_term(Query, Goal, Bindings), !,
    call(Goal),
    export_bindings(Out, Bindings),
    (   wait_want_next
    ->  fail
    ;   !, fail).

wait_want_next:-
    read_line_to_string(user_input, String), !,
    debug(node, 'got input: ~w', [String]),
    atom_json_dict(String, Dict, []),
    Dict.action = "next".

export_error(Out, Error):-
    format(string(String), '~w', [Error]),
    debug(node, 'exporting error ~w', [Error]),
    export_dict(Out, _{
        status: "error",
        error: String
    }).

export_bindings(Out, Bindings):-
    debug(node, 'exporting bindings: ~w', [Bindings]),
    maplist(to_binding_pair, Bindings, Pairs),
    dict_pairs(Dict, _, Pairs),
    export_dict(Out, _{
        status: "success",
        bindings: Dict
    }).

export_failure(Out):-
    debug(node, 'exporting failure', []),
    export_dict(Out, _{ status: "fail" }).

export_dict(Out, Dict):-
    atom_json_dict(String, Dict, [width(0), as(string)]),
    debug(node, 'writing to output: ~w', [String]),
    writeln(Out, String),
    flush_output(Out).

to_binding_pair(Name=Value, Name-Exported):-
    export_term(Value, Exported).

% Exports term into a suitable form to transport
% over JSON.

export_term(Variable, Exported):-
    var(Variable), !,
    format(string(String), '~w', [Variable]),
    Exported = _{ variable: String }.

export_term([], "[]"):- !.

export_term(Atomic, Atomic):-
    atomic(Atomic), !.

export_term([Head|Tail], Exported):- !,
    export_term(Head, HeadExported),
    export_term(Tail, TailExported),
    Exported = _{ head: HeadExported, tail: TailExported }.

export_term(Dict, Exported):-
    is_dict(Dict), !,
    dict_pairs(Dict, Tag, Pairs),
    maplist(export_dict_pair, Pairs, ExportedPairs),
    dict_pairs(ContentExported, _, ExportedPairs),
    export_term(Tag, ExportedTag),
    Exported = _{ tag: ExportedTag, content: ContentExported }.

export_term(Compound, Exported):-
    compound(Compound), !,
    Compound =.. [Name|Args],
    maplist(export_term, Args, ExportedArgs),
    Exported = _{ name: Name, args: ExportedArgs }.

export_term(Term, _):-
    throw(error(cannot_export(Term), _)).

export_dict_pair(Key-Value, Key-ExportedValue):-
    export_term(Value, ExportedValue).
