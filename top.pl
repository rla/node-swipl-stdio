:- set_stream(user_input, tty(false)).
:- set_stream(user_input, encoding(utf8)).
:- set_stream(user_output, tty(false)).
:- set_stream(user_output, encoding(utf8)).

:- use_module(library(http/json)).

% Toplevel executor. Implemented as a
% failure-driven loop.

loop:-
    current_output(Out),
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
        atom_json_dict(String, Dict, []), !,
        (   execute_query(Out, Dict.query)
        ;   export_failure(Out) )).

% Executes the given query. Reports solutions
% through a failure-driven loop which is conditionally
% cut once the user requests to close the query.

execute_query(Out, Query):-
    atom_to_term(Query, Goal, Bindings), !,
    call(Goal),
    export_bindings(Out, Bindings),
    (   wait_want_next
    ->  fail
    ;   !, fail).

wait_want_next:-
    read_line_to_string(user_input, String), !,
    atom_json_dict(String, Dict, []),
    Dict.action = "next".

export_error(Out, Error):-
    format(string(String), '~w', [Error]),
    export_dict(Out, _{
        status: "error",
        error: String
    }).

export_bindings(Out, Bindings):-
    maplist(to_pair, Bindings, Pairs),
    dict_pairs(Dict, _, Pairs),
    export_dict(Out, _{
        status: "success",
        bindings: Dict
    }).

export_failure(Out):-
    export_dict(Out, _{ status: "fail" }).

export_dict(Out, Dict):-
    json_write_dict(Out, Dict, [width(0)]),
    nl(Out),
    flush_output(Out).

to_pair(Name=Value, Name-Value).
