+ function () {
	window .page_exists =	function (page_name) {
								return window .uis [page_name] || window ._riot_pages .indexOf (page_name) !== -1;
							};
	window .page_name =	function (path) {
							var hash_position = path .indexOf ('#');
							var params_position = path .indexOf ('/#');
							
							var begin_position = hash_position + 1;
							var end_position =	params_position !== -1 || path [path .length - 1] === '/' ?
													params_position
												:
													undefined;
							
							return path .slice (begin_position, end_position) .split ('/') .join ('-') || routes .default;
						};
	window .page_params =	function (path) {
								return path .indexOf ('/#') !== -1 ?
										path .slice (path .indexOf ('/#') + '/#' .length) .split ('/')
									:
										[];
							};
	window .page_hash = 	function (path) {
								var params = window .page_params (path);
								return '#' + window .page_name (path) .split ('-') .join ('/') + (params .length ? '/#' + params .join ('/') : '');
							};
		
	var ui_ = function (page_name) {
		return window .uis [page_name];
	};
	var nav_of = R .cond ([
		[R .identity, R .prop ('nav')]]);
	var dom_of = function (x) {
		return x .dom || x .state && x .state () .dom || x .root;
	};
	var sync_hash = function (nav_state) {
		if (R .hasIn ('transition') (nav_state))
			replace_hash (nav_state .hash);
		else
			silent_replace_hash (nav_state .hash);
	};
		var replace_hash = function (x) {
			window .history .pushState (null, null, x);
		};
		var silent_replace_hash = function (x) {
			window .history .replaceState (null, null, x);
		};
	var replace_dom = function (curr, last_state) {
		document .body .insertBefore (dom_of (curr), document .body .firstElementChild);
		if (last_state) {
			document .body .removeChild (dom_of (last_state));
		}
	};
	var make_nav = function (naver, _name) {
		var x = interaction (noop);
		[x .state]
			.forEach (tap (function (transition_info) {
				var transition = R .head (transition_info);
				var nav_intent =	R .merge (
										[routing (_name, transition)]
											.map (R .applySpec ({
												page: window .page_name,
												params: window .page_params,
												hash: window .page_hash
											}))
										[0]
									) ({
										transition: transition,
										args: R .tail (transition_info)
									});
				naver .intent (['nav', nav_intent, naver .state ()]);
			}));
		return x;
	};
	var make_page = function (naver, nav_intent) {
		if (ui_ (nav_intent .page)) {
			var nav = make_nav (naver, nav_intent .page);
			return	R .merge (
						ui_ (
							nav_intent .page
						) ({}, { nav: nav }),
						{
							nav: nav
						}
					)
		}
		else {
			var nav = make_nav (naver, nav_intent .page);
			var _tag_name = tag_name (nav_intent .page);
			var x =	riot .mount (
						document .createElement (_tag_name),
						_tag_name,
						nav_intent .params
					) [0];
			if (x .nav) {
				[nav .intent] .forEach (tap (x .nav .intent));
				[x .nav .state] .forEach (tap (nav .state));
			}
			return retaining ({ nav: nav }) (x);
		}		
	};
		var tag_name =	function (page_name) {
							return 'page-' + page_name;
						};
	var intent_to_state = function (intent, page) {
		return retaining (intent) (page);
	};
	var intent_from_state = function (state) {
		return Object .getPrototypeOf (state)
	};
		
	window .master_ui = function (components, unions) {
		var loaded_pages = stream ({});
		
		var extension = interaction (transition (function (intent, license) {
			if (intent [0] === 'nav') {
				var nav_intent = intent [1];
				var last_state = intent [2];
				
				return function (tenure) {
					var time = new Date ();
					
					var cached = loaded_pages () [nav_intent .hash];
					var curr = cached ?
							intent_to_state (nav_intent, cached)
						:
							intent_to_state (nav_intent, make_page (extension, nav_intent));
					
					if (nav_of (curr)) {
						nav_of (curr) .intent (['prepare', curr .transition] .concat (curr .args || []));
					}
					if (! license ()) {
						if (last_state !== curr) {
							var _time = new Date ();
							
							sync_hash (curr);
							replace_dom (curr, last_state);
							
							log ('render page time ' + (new Date () - _time) + 'ms', curr);	
						}
						var last_loaded = curr;
					}
					else {
						var last_loaded = last_state;
					}
					
					if (last_state) {
						nav_of (last_state) .intent (['reset']);
					}
		
					log ('process page time ' + (new Date () - time) + 'ms', curr);	
		
					tenure (last_loaded);
					tenure .end (true);
					if (license ())
						extension .intent (license ());
				}
			}
			else {
				return decline_ (intent);
			}
		}));
		
		
		var manual_nav = stream ();
		[manual_nav]
			.map (map (R .applySpec ({
				page: window .page_name,
				params: window .page_params,
				hash: window .page_hash
			})))
			.map (filter (R .pipe (R .prop ('page'), window .page_exists)))
			.forEach (tap (function (nav_intent) {
				extension .intent (['nav', nav_intent, extension .state ()]);
			}));
		window .addEventListener ('hashchange', function () {
			manual_nav (window .location .hash)
		});
		
		if (window .page_exists (window .page_name (window .location .hash))) {
			manual_nav (window .location .hash)
		}
		else {
			window .location .hash = routes .default;
		}
		
		[extension .state]
			.map (filter (R .identity))
			.map (dropRepeats)
			.forEach (tap (function (page) {
				if (! loaded_pages () [page .hash] && ! page .temp)
					loaded_pages (
						R .assoc (page .hash, intent_from_state (page)) (loaded_pages ()))
			}));
			
		return {
			_: extension,
			loaded_pages: loaded_pages
		};		
	};
} ();
