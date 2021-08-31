
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35730/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.42.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.42.4 */

    const file = "src/App.svelte";

    // (95:6) {:else}
    function create_else_block_1(ctx) {
    	let svg;
    	let desc;
    	let t;
    	let g;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			desc = svg_element("desc");
    			t = text("Robot hand by Eucalyp from the Noun Project");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			add_location(desc, file, 96, 10, 9105);
    			attr_dev(path0, "d", "m 37,53 v -2 m 0,0 h -4 v -2.382 l 4,-2 v -3.802 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 v 2.566 l -4,2 V 51 h -2 v -8.184 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 V 51 h -2 v -3.618 l -4,-2 v -2.566 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 v 3.802 l 4,2 V 51 H 15 V 35 h 26 v 16 h -2 m 0,0 -0.257,2 m 0,0 h 1.639 L 43,53.005 V 33 h -2 l -0.06012,-1.309104 1.969941,0.345448 1.381791,-7.879762 -1.96994,-0.345448 0.345448,-1.969941 1.96994,0.345448 1.381792,-7.879762 -1.969941,-0.345448 0.345448,-1.969941 1.969941,0.345448 1.209068,-6.8947916 C 47.859054,3.8130056 46.76577,2.2547492 45.13663,1.9690638 43.507489,1.6833783 41.949232,2.7766619 41.663547,4.4058027 l -1.209068,6.8947923 1.969941,0.345448 -0.345448,1.96994 -1.969941,-0.345448 -1.381791,7.879762 1.96994,0.345448 -0.345448,1.969941 -1.96994,-0.345448 L 37,31 38.969941,31.345448 39,33 h -6 l -0.01015,-2.284704 1.994928,-0.142351 -0.569408,-7.979711 -1.994927,0.142352 -0.142352,-1.994927 1.994928,-0.142352 -0.569408,-7.97971 -1.994927,0.142351 -0.142352,-1.994927 1.994928,-0.142352 -0.498232,-6.9822465 C 32.945308,1.9916174 31.506919,0.74483396 29.857114,0.86255891 28.207309,0.98028386 26.960526,2.4186729 27.07825,4.068478 l 0.498232,6.982246 1.994927,-0.142351 0.142352,1.994927 -1.994927,0.142352 0.569407,7.97971 1.994927,-0.142352 0.142352,1.994928 L 28.430593,23.02029 29,31 30.994928,30.857648 31,33 h -6 v -1.827 h 2 v -7 c 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 v 7 h 2 V 33 h -6 v -1.827 h 2 v -7 c 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 v 7 h 2 V 33 H 13 V 52.974 L 15.516,53 H 37 M 29.073178,3.9261262 c -0.03922,-0.5496026 0.376685,-1.0294218 0.926288,-1.0686397 0.549602,-0.039218 1.029422,0.3766853 1.06864,0.9262878 l 0.355879,4.9873189 -1.994927,0.1423518 z m 0.782935,10.9721018 1.994928,-0.142352 0.284703,3.989855 -1.994927,0.142352 z m 0.711759,9.974638 1.994928,-0.142352 0.284703,3.989855 -1.994927,0.142352 z M 23,24.173 c 0,-0.551 0.449,-1 1,-1 0.551,0 1,0.449 1,1 v 5 h -2 z m -8,0 c 0,-0.551 0.449,-1 1,-1 0.551,0 1,0.449 1,1 v 5 H 15 Z M 36,39 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m -8,0 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m -8,0 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m 21.285329,-9.279045 -1.969941,-0.345448 0.690896,-3.939881 1.969941,0.345448 z m 1.72724,-9.849702 -1.969941,-0.345448 0.690896,-3.939881 1.96994,0.345448 z m 1.727239,-9.849703 -1.96994,-0.345448 0.863619,-4.9248514 c 0.09517,-0.5427186 0.614976,-0.9074172 1.157695,-0.8122463 0.542718,0.095171 0.907417,0.6149756 0.812246,1.1576942 z");
    			attr_dev(path0, "sodipodi:nodetypes", "cccccccsssccccccsssccccccsssccccccccccccccccccccccccccsssccccccccccccccccccccccsssccccccccccccccsssccccccssscccccccsssccsccccccccccsssccssssccssssssssssssssssccccccccccccsssc");
    			add_location(path0, file, 98, 12, 9229);
    			attr_dev(path1, "d", "M 51.059 34.291 L 49.594 32.926 L 45.042 29.059 L 45 32.62 L 45 47.817 L 53.865 36.906 L 51.059 34.291 Z M 47 42.184 L 47 33.38 L 47.067 33.304 L 51.134 37.094 L 47 42.184 Z");
    			add_location(path1, file, 102, 12, 12390);
    			attr_dev(g, "transform", "matrix(0, -1, -1, 0, 68, 68)");
    			add_location(g, file, 97, 10, 9172);
    			attr_dev(svg, "class", "play-icons player-icon svelte-k1qkkj");
    			attr_dev(svg, "id", "playerScissorsIcon");
    			add_location(svg, file, 95, 8, 9034);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, desc);
    			append_dev(desc, t);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(95:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (83:35) 
    function create_if_block_3(ctx) {
    	let svg;
    	let desc;
    	let t;
    	let g;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			desc = svg_element("desc");
    			t = text("Robot hand by Eucalyp from the Noun Project");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			add_location(desc, file, 84, 10, 4678);
    			attr_dev(path0, "d", "M 37 103.69 L 37 101.69 M 37 101.69 L 33 101.69 L 33 99.308 L 37 97.308 L 37 93.506 C 38.161 93.092 39 91.992 39 90.69 C 39 89.036 37.654 87.69 36 87.69 C 34.346 87.69 33 89.036 33 90.69 C 33 91.992 33.839 93.092 35 93.506 L 35 96.072 L 31 98.072 L 31 101.69 L 29 101.69 L 29 93.506 C 30.161 93.092 31 91.992 31 90.69 C 31 89.036 29.654 87.69 28 87.69 C 26.346 87.69 25 89.036 25 90.69 C 25 91.992 25.839 93.092 27 93.506 L 27 101.69 L 25 101.69 L 25 98.072 L 21 96.072 L 21 93.506 C 22.161 93.092 23 91.992 23 90.69 C 23 89.036 21.654 87.69 20 87.69 C 18.346 87.69 17 89.036 17 90.69 C 17 91.992 17.839 93.092 19 93.506 L 19 97.308 L 23 99.308 L 23 101.69 L 15 101.69 L 15 85.69 L 41 85.69 L 41 101.69 L 39 101.69 M 39 101.69 L 39 103.69 M 39 103.69 L 40.382 103.69 L 43 103.639 L 43 83.69 L 41 83.69 L 41 81.69 L 43 81.69 L 43 73.69 L 41 73.69 L 41 71.69 L 43 71.69 L 43 63.69 L 41 63.69 L 41 61.69 L 43 61.69 L 43 54.69 C 43 53.036 41.654 51.69 40 51.69 L 40 51.69 C 38.346 51.69 37 53.036 37 54.69 L 37 61.69 L 39 61.69 L 39 63.69 L 37 63.69 L 37 71.69 L 39 71.69 L 39 73.69 L 37 73.69 L 37 81.69 L 39 81.69 L 39 83.69 L 33 83.69 L 33 81.69 L 35 81.69 L 35 73.69 L 33 73.69 L 33 71.69 L 35 71.69 L 35 63.69 L 33 63.69 L 33 61.69 L 35 61.69 L 35 54.69 C 35 53.036 33.654 51.69 32 51.69 C 30.346 51.69 29 53.036 29 54.69 L 29 61.69 L 31 61.69 L 31 63.69 L 29 63.69 L 29 71.69 L 31 71.69 L 31 73.69 L 29 73.69 L 29 81.69 L 31 81.69 L 31 83.69 L 25 83.69 L 25 81.69 L 27 81.69 L 27 73.69 L 25 73.69 L 25 71.69 L 27 71.69 L 27 63.69 L 25 63.69 L 25 61.69 L 27 61.69 L 27 54.69 C 27 53.036 25.654 51.69 24 51.69 C 22.346 51.69 21 53.036 21 54.69 L 21 61.69 L 23 61.69 L 23 63.69 L 21 63.69 L 21 71.69 L 23 71.69 L 23 73.69 L 21 73.69 L 21 81.69 L 23 81.69 L 23 83.69 L 17 83.69 L 17 81.69 L 19 81.69 L 19 73.69 L 17 73.69 L 17 71.69 L 19 71.69 L 19 63.69 L 17 63.69 L 17 61.69 L 19 61.69 L 19 54.69 C 19 53.036 17.654 51.69 16 51.69 C 14.346 51.69 13 53.036 13 54.69 L 13 61.69 L 15 61.69 L 15 63.69 L 13 63.69 L 13 71.69 L 15 71.69 L 15 73.69 L 13 73.69 L 13 81.69 L 15 81.69 L 15 83.69 L 13 83.69 L 13 103.697 L 15.516 103.69 L 37 103.69 M 31 54.69 C 31 54.139 31.449 53.69 32 53.69 C 32.551 53.69 33 54.139 33 54.69 L 33 59.69 L 31 59.69 L 31 54.69 Z M 31 65.69 L 33 65.69 L 33 69.69 L 31 69.69 L 31 65.69 Z M 31 75.69 L 33 75.69 L 33 79.69 L 31 79.69 L 31 75.69 Z M 23 54.69 C 23 54.139 23.449 53.69 24 53.69 C 24.551 53.69 25 54.139 25 54.69 L 25 59.69 L 23 59.69 L 23 54.69 Z M 23 65.69 L 25 65.69 L 25 69.69 L 23 69.69 L 23 65.69 Z M 23 75.69 L 25 75.69 L 25 79.69 L 23 79.69 L 23 75.69 Z M 15 54.69 C 15 54.139 15.449 53.69 16 53.69 C 16.551 53.69 17 54.139 17 54.69 L 17 59.69 L 15 59.69 L 15 54.69 Z M 15 65.69 L 17 65.69 L 17 69.69 L 15 69.69 L 15 65.69 Z M 15 75.69 L 17 75.69 L 17 79.69 L 15 79.69 L 15 75.69 Z M 36 89.69 C 36.551 89.69 37 90.139 37 90.69 C 37 91.241 36.551 91.69 36 91.69 C 35.449 91.69 35 91.241 35 90.69 C 35 90.139 35.449 89.69 36 89.69 Z M 28 89.69 C 28.551 89.69 29 90.139 29 90.69 C 29 91.241 28.551 91.69 28 91.69 C 27.449 91.69 27 91.241 27 90.69 C 27 90.139 27.449 89.69 28 89.69 Z M 20 89.69 C 20.551 89.69 21 90.139 21 90.69 C 21 91.241 20.551 91.69 20 91.69 C 19.449 91.69 19 91.241 19 90.69 C 19 90.139 19.449 89.69 20 89.69 Z M 41 79.69 L 39 79.69 L 39 75.69 L 41 75.69 L 41 79.69 Z M 41 69.69 L 39 69.69 L 39 65.69 L 41 65.69 L 41 69.69 Z M 41 59.69 L 39 59.69 L 39 54.69 C 39 54.139 39.449 53.69 40 53.69 C 40.551 53.69 41 54.139 41 54.69 L 41 59.69 Z");
    			add_location(path0, file, 86, 12, 4828);
    			attr_dev(path1, "d", "M 55.549 73.69 C 54.279 73.69 53.067 74.234 52.223 75.184 L 48.149 79.767 L 50.802 82.166 L 49.594 83.616 L 46.933 81.136 L 45 83.31 L 45 98.507 L 53.865 87.596 L 51.059 84.981 L 52.286 83.508 L 55.111 86.062 L 59.003 81.271 C 59.646 80.481 60 79.484 60 78.465 L 60 78.141 C 60 75.687 58.003 73.69 55.549 73.69 Z M 47 92.874 L 47 84.07 L 47.067 83.994 L 51.134 87.784 L 47 92.874 Z M 58 78.465 C 58 79.026 57.805 79.575 57.451 80.01 L 54.889 83.164 L 50.962 79.613 L 53.718 76.512 C 54.183 75.99 54.85 75.69 55.549 75.69 C 56.9 75.69 58 76.79 58 78.141 L 58 78.465 Z");
    			add_location(path1, file, 89, 12, 8376);
    			attr_dev(g, "transform", "matrix(0, -1, -1, 0, 119, 68)");
    			attr_dev(g, "bx:origin", "0.5 0.634665");
    			add_location(g, file, 85, 10, 4745);
    			attr_dev(svg, "class", "play-icons player-icon svelte-k1qkkj");
    			attr_dev(svg, "id", "playerPaperIcon");
    			add_location(svg, file, 83, 8, 4610);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, desc);
    			append_dev(desc, t);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(83:35) ",
    		ctx
    	});

    	return block;
    }

    // (71:6) {#if player === 'rock' || animated}
    function create_if_block_2(ctx) {
    	let svg;
    	let desc;
    	let t;
    	let g;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			desc = svg_element("desc");
    			t = text("Robot hand by Eucalyp from the Noun Project");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			add_location(desc, file, 72, 10, 1566);
    			attr_dev(path0, "d", "M 37 53 L 37 51 M 37 51 L 33 51 L 33 48.618 L 37 46.618 L 37 42.816 C 38.161 42.402 39 41.302 39 40 C 39 38.346 37.654 37 36 37 C 34.346 37 33 38.346 33 40 C 33 41.302 33.839 42.402 35 42.816 L 35 45.382 L 31 47.382 L 31 51 L 29 51 L 29 42.816 C 30.161 42.402 31 41.302 31 40 C 31 38.346 29.654 37 28 37 C 26.346 37 25 38.346 25 40 C 25 41.302 25.839 42.402 27 42.816 L 27 51 L 25 51 L 25 47.382 L 21 45.382 L 21 42.816 C 22.161 42.402 23 41.302 23 40 C 23 38.346 21.654 37 20 37 C 18.346 37 17 38.346 17 40 C 17 41.302 17.839 42.402 19 42.816 L 19 46.618 L 23 48.618 L 23 51 L 15 51 L 15 35 L 41 35 L 41 51 L 39 51 M 39 51 L 38.743 53 M 38.743 53 L 40.382 53 L 43 53.005 L 43 33 L 41 33 L 41 31 L 43 31 L 43 23 L 41 23 L 41 21.103 L 43 21.103 L 43 17.831 C 43 16.177 41.654 14.831 40 14.831 C 38.346 14.831 37 16.177 37 17.831 L 37 21.103 L 39 21.103 L 39 23 L 37 23 L 37 31 L 39 31 L 39 33 L 33 33 L 33 31 L 35 31 L 35 23 L 33 23 L 33 21.103 L 35 21.103 L 35 17.831 C 35 16.177 33.654 14.831 32 14.831 C 30.346 14.831 29 16.177 29 17.831 L 29 21.103 L 31 21.103 L 31 23 L 29 23 L 29 31 L 31 31 L 31 33 L 25 33 L 25 31 L 27 31 L 27 23 L 25 23 L 25 21.103 L 27 21.103 L 27 17.831 C 27 16.177 25.654 14.831 24 14.831 C 22.346 14.831 21 16.177 21 17.831 L 21 21.103 L 23 21.103 L 23 23 L 21 23 L 21 31 L 23 31 L 23 33 L 17 33 L 17 31 L 19 31 L 19 23 L 17 23 L 17 21.103 L 19 21.103 L 19 17.831 C 19 16.177 17.654 14.831 16 14.831 C 14.346 14.831 13 16.177 13 17.831 L 13 21.103 L 15 21.103 L 15 23 L 13 23 L 13 31 L 15 31 L 15 33 L 13 33 L 13 52.974 L 15.516 53 L 37 53 M 31 17.831 C 31 17.28 31.449 16.831 32 16.831 C 32.551 16.831 33 17.28 33 17.831 L 33 19.103 L 31 19.103 L 31 17.831 Z M 31 25 L 33 25 L 33 29 L 31 29 L 31 25 Z M 23 17.831 C 23 17.28 23.449 16.831 24 16.831 C 24.551 16.831 25 17.28 25 17.831 L 25 19.103 L 23 19.103 L 23 17.831 Z M 23 25 L 25 25 L 25 29 L 23 29 L 23 25 Z M 15 17.831 C 15 17.28 15.449 16.831 16 16.831 C 16.551 16.831 17 17.28 17 17.831 L 17 19.103 L 15 19.103 L 15 17.831 Z M 15 25 L 17 25 L 17 29 L 15 29 L 15 25 Z M 36 39 C 36.551 39 37 39.449 37 40 C 37 40.551 36.551 41 36 41 C 35.449 41 35 40.551 35 40 C 35 39.449 35.449 39 36 39 Z M 28 39 C 28.551 39 29 39.449 29 40 C 29 40.551 28.551 41 28 41 C 27.449 41 27 40.551 27 40 C 27 39.449 27.449 39 28 39 Z M 20 39 C 20.551 39 21 39.449 21 40 C 21 40.551 20.551 41 20 41 C 19.449 41 19 40.551 19 40 C 19 39.449 19.449 39 20 39 Z M 41 29 L 39 29 L 39 25 L 41 25 L 41 29 Z M 41 19.103 L 39 19.103 L 39 17.831 C 39 17.28 39.449 16.831 40 16.831 C 40.551 16.831 41 17.28 41 17.831 L 41 19.103 Z");
    			add_location(path0, file, 74, 12, 1690);
    			attr_dev(path1, "d", "M 51.059 34.291 L 49.594 32.926 L 45.096 29.221 L 45 32.62 L 45 47.817 L 53.865 36.906 L 51.059 34.291 Z M 47 42.184 L 47 33.38 L 47.067 33.304 L 51.134 37.094 L 47 42.184 Z");
    			add_location(path1, file, 77, 12, 4323);
    			attr_dev(g, "transform", "matrix(0, -1, -1, 0, 68, 68)");
    			add_location(g, file, 73, 10, 1633);
    			attr_dev(svg, "class", "play-icons player-icon svelte-k1qkkj");
    			attr_dev(svg, "id", "playerRockIcon");
    			add_location(svg, file, 71, 8, 1499);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, desc);
    			append_dev(desc, t);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(71:6) {#if player === 'rock' || animated}",
    		ctx
    	});

    	return block;
    }

    // (143:6) {:else}
    function create_else_block(ctx) {
    	let svg;
    	let desc;
    	let t;
    	let g;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			desc = svg_element("desc");
    			t = text("Robot hand by Eucalyp from the Noun Project");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			add_location(desc, file, 144, 10, 20505);
    			attr_dev(path0, "d", "m 37,53 v -2 m 0,0 h -4 v -2.382 l 4,-2 v -3.802 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 v 2.566 l -4,2 V 51 h -2 v -8.184 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 V 51 h -2 v -3.618 l -4,-2 v -2.566 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 v 3.802 l 4,2 V 51 H 15 V 35 h 26 v 16 h -2 m 0,0 -0.257,2 m 0,0 h 1.639 L 43,53.005 V 33 h -2 l -0.06012,-1.309104 1.969941,0.345448 1.381791,-7.879762 -1.96994,-0.345448 0.345448,-1.969941 1.96994,0.345448 1.381792,-7.879762 -1.969941,-0.345448 0.345448,-1.969941 1.969941,0.345448 1.209068,-6.8947916 C 47.859054,3.8130056 46.76577,2.2547492 45.13663,1.9690638 43.507489,1.6833783 41.949232,2.7766619 41.663547,4.4058027 l -1.209068,6.8947923 1.969941,0.345448 -0.345448,1.96994 -1.969941,-0.345448 -1.381791,7.879762 1.96994,0.345448 -0.345448,1.969941 -1.96994,-0.345448 L 37,31 38.969941,31.345448 39,33 h -6 l -0.01015,-2.284704 1.994928,-0.142351 -0.569408,-7.979711 -1.994927,0.142352 -0.142352,-1.994927 1.994928,-0.142352 -0.569408,-7.97971 -1.994927,0.142351 -0.142352,-1.994927 1.994928,-0.142352 -0.498232,-6.9822465 C 32.945308,1.9916174 31.506919,0.74483396 29.857114,0.86255891 28.207309,0.98028386 26.960526,2.4186729 27.07825,4.068478 l 0.498232,6.982246 1.994927,-0.142351 0.142352,1.994927 -1.994927,0.142352 0.569407,7.97971 1.994927,-0.142352 0.142352,1.994928 L 28.430593,23.02029 29,31 30.994928,30.857648 31,33 h -6 v -1.827 h 2 v -7 c 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 v 7 h 2 V 33 h -6 v -1.827 h 2 v -7 c 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 v 7 h 2 V 33 H 13 V 52.974 L 15.516,53 H 37 M 29.073178,3.9261262 c -0.03922,-0.5496026 0.376685,-1.0294218 0.926288,-1.0686397 0.549602,-0.039218 1.029422,0.3766853 1.06864,0.9262878 l 0.355879,4.9873189 -1.994927,0.1423518 z m 0.782935,10.9721018 1.994928,-0.142352 0.284703,3.989855 -1.994927,0.142352 z m 0.711759,9.974638 1.994928,-0.142352 0.284703,3.989855 -1.994927,0.142352 z M 23,24.173 c 0,-0.551 0.449,-1 1,-1 0.551,0 1,0.449 1,1 v 5 h -2 z m -8,0 c 0,-0.551 0.449,-1 1,-1 0.551,0 1,0.449 1,1 v 5 H 15 Z M 36,39 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m -8,0 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m -8,0 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m 21.285329,-9.279045 -1.969941,-0.345448 0.690896,-3.939881 1.969941,0.345448 z m 1.72724,-9.849702 -1.969941,-0.345448 0.690896,-3.939881 1.96994,0.345448 z m 1.727239,-9.849703 -1.96994,-0.345448 0.863619,-4.9248514 c 0.09517,-0.5427186 0.614976,-0.9074172 1.157695,-0.8122463 0.542718,0.095171 0.907417,0.6149756 0.812246,1.1576942 z");
    			attr_dev(path0, "sodipodi:nodetypes", "cccccccsssccccccsssccccccsssccccccccccccccccccccccccccsssccccccccccccccccccccccsssccccccccccccccsssccccccssscccccccsssccsccccccccccsssccssssccssssssssssssssssccccccccccccsssc");
    			add_location(path0, file, 146, 12, 20629);
    			attr_dev(path1, "d", "M 51.059 34.291 L 49.594 32.926 L 45.042 29.059 L 45 32.62 L 45 47.817 L 53.865 36.906 L 51.059 34.291 Z M 47 42.184 L 47 33.38 L 47.067 33.304 L 51.134 37.094 L 47 42.184 Z");
    			add_location(path1, file, 150, 12, 23790);
    			attr_dev(g, "transform", "matrix(0, -1, -1, 0, 68, 68)");
    			add_location(g, file, 145, 10, 20572);
    			attr_dev(svg, "class", "play-icons computer-icon svelte-k1qkkj");
    			attr_dev(svg, "id", "computerScissorsIcon");
    			add_location(svg, file, 143, 8, 20430);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, desc);
    			append_dev(desc, t);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(143:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (131:37) 
    function create_if_block_1(ctx) {
    	let svg;
    	let desc;
    	let t;
    	let g;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			desc = svg_element("desc");
    			t = text("Robot hand by Eucalyp from the Noun Project");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			add_location(desc, file, 132, 10, 16074);
    			attr_dev(path0, "d", "M 37 103.69 L 37 101.69 M 37 101.69 L 33 101.69 L 33 99.308 L 37 97.308 L 37 93.506 C 38.161 93.092 39 91.992 39 90.69 C 39 89.036 37.654 87.69 36 87.69 C 34.346 87.69 33 89.036 33 90.69 C 33 91.992 33.839 93.092 35 93.506 L 35 96.072 L 31 98.072 L 31 101.69 L 29 101.69 L 29 93.506 C 30.161 93.092 31 91.992 31 90.69 C 31 89.036 29.654 87.69 28 87.69 C 26.346 87.69 25 89.036 25 90.69 C 25 91.992 25.839 93.092 27 93.506 L 27 101.69 L 25 101.69 L 25 98.072 L 21 96.072 L 21 93.506 C 22.161 93.092 23 91.992 23 90.69 C 23 89.036 21.654 87.69 20 87.69 C 18.346 87.69 17 89.036 17 90.69 C 17 91.992 17.839 93.092 19 93.506 L 19 97.308 L 23 99.308 L 23 101.69 L 15 101.69 L 15 85.69 L 41 85.69 L 41 101.69 L 39 101.69 M 39 101.69 L 39 103.69 M 39 103.69 L 40.382 103.69 L 43 103.639 L 43 83.69 L 41 83.69 L 41 81.69 L 43 81.69 L 43 73.69 L 41 73.69 L 41 71.69 L 43 71.69 L 43 63.69 L 41 63.69 L 41 61.69 L 43 61.69 L 43 54.69 C 43 53.036 41.654 51.69 40 51.69 L 40 51.69 C 38.346 51.69 37 53.036 37 54.69 L 37 61.69 L 39 61.69 L 39 63.69 L 37 63.69 L 37 71.69 L 39 71.69 L 39 73.69 L 37 73.69 L 37 81.69 L 39 81.69 L 39 83.69 L 33 83.69 L 33 81.69 L 35 81.69 L 35 73.69 L 33 73.69 L 33 71.69 L 35 71.69 L 35 63.69 L 33 63.69 L 33 61.69 L 35 61.69 L 35 54.69 C 35 53.036 33.654 51.69 32 51.69 C 30.346 51.69 29 53.036 29 54.69 L 29 61.69 L 31 61.69 L 31 63.69 L 29 63.69 L 29 71.69 L 31 71.69 L 31 73.69 L 29 73.69 L 29 81.69 L 31 81.69 L 31 83.69 L 25 83.69 L 25 81.69 L 27 81.69 L 27 73.69 L 25 73.69 L 25 71.69 L 27 71.69 L 27 63.69 L 25 63.69 L 25 61.69 L 27 61.69 L 27 54.69 C 27 53.036 25.654 51.69 24 51.69 C 22.346 51.69 21 53.036 21 54.69 L 21 61.69 L 23 61.69 L 23 63.69 L 21 63.69 L 21 71.69 L 23 71.69 L 23 73.69 L 21 73.69 L 21 81.69 L 23 81.69 L 23 83.69 L 17 83.69 L 17 81.69 L 19 81.69 L 19 73.69 L 17 73.69 L 17 71.69 L 19 71.69 L 19 63.69 L 17 63.69 L 17 61.69 L 19 61.69 L 19 54.69 C 19 53.036 17.654 51.69 16 51.69 C 14.346 51.69 13 53.036 13 54.69 L 13 61.69 L 15 61.69 L 15 63.69 L 13 63.69 L 13 71.69 L 15 71.69 L 15 73.69 L 13 73.69 L 13 81.69 L 15 81.69 L 15 83.69 L 13 83.69 L 13 103.697 L 15.516 103.69 L 37 103.69 M 31 54.69 C 31 54.139 31.449 53.69 32 53.69 C 32.551 53.69 33 54.139 33 54.69 L 33 59.69 L 31 59.69 L 31 54.69 Z M 31 65.69 L 33 65.69 L 33 69.69 L 31 69.69 L 31 65.69 Z M 31 75.69 L 33 75.69 L 33 79.69 L 31 79.69 L 31 75.69 Z M 23 54.69 C 23 54.139 23.449 53.69 24 53.69 C 24.551 53.69 25 54.139 25 54.69 L 25 59.69 L 23 59.69 L 23 54.69 Z M 23 65.69 L 25 65.69 L 25 69.69 L 23 69.69 L 23 65.69 Z M 23 75.69 L 25 75.69 L 25 79.69 L 23 79.69 L 23 75.69 Z M 15 54.69 C 15 54.139 15.449 53.69 16 53.69 C 16.551 53.69 17 54.139 17 54.69 L 17 59.69 L 15 59.69 L 15 54.69 Z M 15 65.69 L 17 65.69 L 17 69.69 L 15 69.69 L 15 65.69 Z M 15 75.69 L 17 75.69 L 17 79.69 L 15 79.69 L 15 75.69 Z M 36 89.69 C 36.551 89.69 37 90.139 37 90.69 C 37 91.241 36.551 91.69 36 91.69 C 35.449 91.69 35 91.241 35 90.69 C 35 90.139 35.449 89.69 36 89.69 Z M 28 89.69 C 28.551 89.69 29 90.139 29 90.69 C 29 91.241 28.551 91.69 28 91.69 C 27.449 91.69 27 91.241 27 90.69 C 27 90.139 27.449 89.69 28 89.69 Z M 20 89.69 C 20.551 89.69 21 90.139 21 90.69 C 21 91.241 20.551 91.69 20 91.69 C 19.449 91.69 19 91.241 19 90.69 C 19 90.139 19.449 89.69 20 89.69 Z M 41 79.69 L 39 79.69 L 39 75.69 L 41 75.69 L 41 79.69 Z M 41 69.69 L 39 69.69 L 39 65.69 L 41 65.69 L 41 69.69 Z M 41 59.69 L 39 59.69 L 39 54.69 C 39 54.139 39.449 53.69 40 53.69 C 40.551 53.69 41 54.139 41 54.69 L 41 59.69 Z");
    			add_location(path0, file, 134, 12, 16224);
    			attr_dev(path1, "d", "M 55.549 73.69 C 54.279 73.69 53.067 74.234 52.223 75.184 L 48.149 79.767 L 50.802 82.166 L 49.594 83.616 L 46.933 81.136 L 45 83.31 L 45 98.507 L 53.865 87.596 L 51.059 84.981 L 52.286 83.508 L 55.111 86.062 L 59.003 81.271 C 59.646 80.481 60 79.484 60 78.465 L 60 78.141 C 60 75.687 58.003 73.69 55.549 73.69 Z M 47 92.874 L 47 84.07 L 47.067 83.994 L 51.134 87.784 L 47 92.874 Z M 58 78.465 C 58 79.026 57.805 79.575 57.451 80.01 L 54.889 83.164 L 50.962 79.613 L 53.718 76.512 C 54.183 75.99 54.85 75.69 55.549 75.69 C 56.9 75.69 58 76.79 58 78.141 L 58 78.465 Z");
    			add_location(path1, file, 137, 12, 19772);
    			attr_dev(g, "transform", "matrix(0, -1, -1, 0, 119, 68)");
    			attr_dev(g, "bx:origin", "0.5 0.634665");
    			add_location(g, file, 133, 10, 16141);
    			attr_dev(svg, "class", "play-icons computer-icon svelte-k1qkkj");
    			attr_dev(svg, "id", "computerPaperIcon");
    			add_location(svg, file, 131, 8, 16002);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, desc);
    			append_dev(desc, t);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(131:37) ",
    		ctx
    	});

    	return block;
    }

    // (119:6) {#if computer === 'rock' || animated}
    function create_if_block(ctx) {
    	let svg;
    	let desc;
    	let t;
    	let g;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			desc = svg_element("desc");
    			t = text("Robot hand by Eucalyp from the Noun Project");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			add_location(desc, file, 120, 10, 12956);
    			attr_dev(path0, "d", "M 37 53 L 37 51 M 37 51 L 33 51 L 33 48.618 L 37 46.618 L 37 42.816 C 38.161 42.402 39 41.302 39 40 C 39 38.346 37.654 37 36 37 C 34.346 37 33 38.346 33 40 C 33 41.302 33.839 42.402 35 42.816 L 35 45.382 L 31 47.382 L 31 51 L 29 51 L 29 42.816 C 30.161 42.402 31 41.302 31 40 C 31 38.346 29.654 37 28 37 C 26.346 37 25 38.346 25 40 C 25 41.302 25.839 42.402 27 42.816 L 27 51 L 25 51 L 25 47.382 L 21 45.382 L 21 42.816 C 22.161 42.402 23 41.302 23 40 C 23 38.346 21.654 37 20 37 C 18.346 37 17 38.346 17 40 C 17 41.302 17.839 42.402 19 42.816 L 19 46.618 L 23 48.618 L 23 51 L 15 51 L 15 35 L 41 35 L 41 51 L 39 51 M 39 51 L 38.743 53 M 38.743 53 L 40.382 53 L 43 53.005 L 43 33 L 41 33 L 41 31 L 43 31 L 43 23 L 41 23 L 41 21.103 L 43 21.103 L 43 17.831 C 43 16.177 41.654 14.831 40 14.831 C 38.346 14.831 37 16.177 37 17.831 L 37 21.103 L 39 21.103 L 39 23 L 37 23 L 37 31 L 39 31 L 39 33 L 33 33 L 33 31 L 35 31 L 35 23 L 33 23 L 33 21.103 L 35 21.103 L 35 17.831 C 35 16.177 33.654 14.831 32 14.831 C 30.346 14.831 29 16.177 29 17.831 L 29 21.103 L 31 21.103 L 31 23 L 29 23 L 29 31 L 31 31 L 31 33 L 25 33 L 25 31 L 27 31 L 27 23 L 25 23 L 25 21.103 L 27 21.103 L 27 17.831 C 27 16.177 25.654 14.831 24 14.831 C 22.346 14.831 21 16.177 21 17.831 L 21 21.103 L 23 21.103 L 23 23 L 21 23 L 21 31 L 23 31 L 23 33 L 17 33 L 17 31 L 19 31 L 19 23 L 17 23 L 17 21.103 L 19 21.103 L 19 17.831 C 19 16.177 17.654 14.831 16 14.831 C 14.346 14.831 13 16.177 13 17.831 L 13 21.103 L 15 21.103 L 15 23 L 13 23 L 13 31 L 15 31 L 15 33 L 13 33 L 13 52.974 L 15.516 53 L 37 53 M 31 17.831 C 31 17.28 31.449 16.831 32 16.831 C 32.551 16.831 33 17.28 33 17.831 L 33 19.103 L 31 19.103 L 31 17.831 Z M 31 25 L 33 25 L 33 29 L 31 29 L 31 25 Z M 23 17.831 C 23 17.28 23.449 16.831 24 16.831 C 24.551 16.831 25 17.28 25 17.831 L 25 19.103 L 23 19.103 L 23 17.831 Z M 23 25 L 25 25 L 25 29 L 23 29 L 23 25 Z M 15 17.831 C 15 17.28 15.449 16.831 16 16.831 C 16.551 16.831 17 17.28 17 17.831 L 17 19.103 L 15 19.103 L 15 17.831 Z M 15 25 L 17 25 L 17 29 L 15 29 L 15 25 Z M 36 39 C 36.551 39 37 39.449 37 40 C 37 40.551 36.551 41 36 41 C 35.449 41 35 40.551 35 40 C 35 39.449 35.449 39 36 39 Z M 28 39 C 28.551 39 29 39.449 29 40 C 29 40.551 28.551 41 28 41 C 27.449 41 27 40.551 27 40 C 27 39.449 27.449 39 28 39 Z M 20 39 C 20.551 39 21 39.449 21 40 C 21 40.551 20.551 41 20 41 C 19.449 41 19 40.551 19 40 C 19 39.449 19.449 39 20 39 Z M 41 29 L 39 29 L 39 25 L 41 25 L 41 29 Z M 41 19.103 L 39 19.103 L 39 17.831 C 39 17.28 39.449 16.831 40 16.831 C 40.551 16.831 41 17.28 41 17.831 L 41 19.103 Z");
    			add_location(path0, file, 122, 12, 13080);
    			attr_dev(path1, "d", "M 51.059 34.291 L 49.594 32.926 L 45.096 29.221 L 45 32.62 L 45 47.817 L 53.865 36.906 L 51.059 34.291 Z M 47 42.184 L 47 33.38 L 47.067 33.304 L 51.134 37.094 L 47 42.184 Z");
    			add_location(path1, file, 125, 12, 15713);
    			attr_dev(g, "transform", "matrix(0, -1, -1, 0, 68, 68)");
    			add_location(g, file, 121, 10, 13023);
    			attr_dev(svg, "class", "play-icons computer-icon svelte-k1qkkj");
    			attr_dev(svg, "id", "computerRockIcon");
    			add_location(svg, file, 119, 8, 12885);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, desc);
    			append_dev(desc, t);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(119:6) {#if computer === 'rock' || animated}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let div3;
    	let div0;
    	let div0_class_value;
    	let t4;
    	let div1;
    	let p1;
    	let t6;
    	let div2;
    	let div2_class_value;
    	let t7;
    	let div8;
    	let div4;
    	let span0;
    	let t8;
    	let span1;
    	let t9;
    	let span2;
    	let t10;
    	let div6;
    	let div5;
    	let p2;
    	let t11;
    	let t12;
    	let p3;
    	let t13;
    	let t14;
    	let t15;
    	let t16;
    	let div7;
    	let span3;
    	let t17;
    	let span4;
    	let t18;
    	let span5;
    	let t19;
    	let div9;
    	let button0;
    	let svg0;
    	let desc0;
    	let t20;
    	let g0;
    	let path0;
    	let path1;
    	let t21;
    	let button1;
    	let svg1;
    	let desc1;
    	let t22;
    	let g1;
    	let path2;
    	let path3;
    	let t23;
    	let button2;
    	let svg2;
    	let desc2;
    	let t24;
    	let g2;
    	let path4;
    	let path5;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*player*/ ctx[3] === 'rock' || /*animated*/ ctx[2]) return create_if_block_2;
    		if (/*player*/ ctx[3] === 'paper') return create_if_block_3;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*computer*/ ctx[4] === 'rock' || /*animated*/ ctx[2]) return create_if_block;
    		if (/*computer*/ ctx[4] === 'paper') return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Rock, Paper, Scissors";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Svelte Edition";
    			t3 = space();
    			div3 = element("div");
    			div0 = element("div");
    			if_block0.c();
    			t4 = space();
    			div1 = element("div");
    			p1 = element("p");
    			p1.textContent = "vs";
    			t6 = space();
    			div2 = element("div");
    			if_block1.c();
    			t7 = space();
    			div8 = element("div");
    			div4 = element("div");
    			span0 = element("span");
    			t8 = space();
    			span1 = element("span");
    			t9 = space();
    			span2 = element("span");
    			t10 = space();
    			div6 = element("div");
    			div5 = element("div");
    			p2 = element("p");
    			t11 = text(/*result*/ ctx[5]);
    			t12 = space();
    			p3 = element("p");
    			t13 = text(/*playerScore*/ ctx[0]);
    			t14 = text(" - ");
    			t15 = text(/*computerScore*/ ctx[1]);
    			t16 = space();
    			div7 = element("div");
    			span3 = element("span");
    			t17 = space();
    			span4 = element("span");
    			t18 = space();
    			span5 = element("span");
    			t19 = space();
    			div9 = element("div");
    			button0 = element("button");
    			svg0 = svg_element("svg");
    			desc0 = svg_element("desc");
    			t20 = text("Robot hand by Eucalyp from the Noun Project");
    			g0 = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			t21 = space();
    			button1 = element("button");
    			svg1 = svg_element("svg");
    			desc1 = svg_element("desc");
    			t22 = text("Robot hand by Eucalyp from the Noun Project");
    			g1 = svg_element("g");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			t23 = space();
    			button2 = element("button");
    			svg2 = svg_element("svg");
    			desc2 = svg_element("desc");
    			t24 = text("Robot hand by Eucalyp from the Noun Project");
    			g2 = svg_element("g");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			attr_dev(h1, "class", "svelte-k1qkkj");
    			add_location(h1, file, 61, 2, 1204);
    			add_location(p0, file, 62, 2, 1237);
    			attr_dev(div0, "class", div0_class_value = "play-icon-container " + (/*animated*/ ctx[2] ? 'shaking' : '') + " svelte-k1qkkj");
    			attr_dev(div0, "id", "playerIconContainer");
    			add_location(div0, file, 65, 4, 1303);
    			attr_dev(p1, "id", "vs");
    			add_location(p1, file, 111, 6, 12693);
    			attr_dev(div1, "class", "screen-text svelte-k1qkkj");
    			add_location(div1, file, 110, 4, 12661);
    			attr_dev(div2, "class", div2_class_value = "play-icon-container " + (/*animated*/ ctx[2] ? 'shaking' : '') + " svelte-k1qkkj");
    			attr_dev(div2, "id", "computerIconContainer");
    			add_location(div2, file, 114, 4, 12727);
    			attr_dev(div3, "class", "screen svelte-k1qkkj");
    			attr_dev(div3, "id", "gameScreen");
    			add_location(div3, file, 64, 2, 1262);
    			attr_dev(span0, "class", "circle");
    			add_location(span0, file, 162, 6, 24204);
    			attr_dev(span1, "class", "circle");
    			add_location(span1, file, 163, 6, 24234);
    			attr_dev(span2, "class", "circle");
    			add_location(span2, file, 164, 6, 24264);
    			attr_dev(div4, "class", "player-score-container");
    			add_location(div4, file, 161, 4, 24161);
    			attr_dev(p2, "id", "result");
    			add_location(p2, file, 169, 8, 24396);
    			attr_dev(p3, "id", "score");
    			add_location(p3, file, 170, 8, 24432);
    			attr_dev(div5, "class", "screen-text svelte-k1qkkj");
    			attr_dev(div5, "id", "results");
    			add_location(div5, file, 168, 6, 24349);
    			attr_dev(div6, "class", "screen svelte-k1qkkj");
    			attr_dev(div6, "id", "resultScreen");
    			add_location(div6, file, 167, 4, 24304);
    			attr_dev(span3, "class", "circle");
    			add_location(span3, file, 176, 6, 24601);
    			attr_dev(span4, "class", "circle");
    			add_location(span4, file, 177, 6, 24631);
    			attr_dev(span5, "class", "circle");
    			add_location(span5, file, 178, 6, 24661);
    			attr_dev(div7, "class", "computer-score-container");
    			add_location(div7, file, 175, 4, 24556);
    			attr_dev(div8, "class", "result-container");
    			attr_dev(div8, "id", "result-container");
    			add_location(div8, file, 159, 2, 24068);
    			add_location(desc0, file, 193, 8, 25001);
    			attr_dev(path0, "d", "M 37 53 L 37 51 M 37 51 L 33 51 L 33 48.618 L 37 46.618 L 37 42.816 C 38.161 42.402 39 41.302 39 40 C 39 38.346 37.654 37 36 37 C 34.346 37 33 38.346 33 40 C 33 41.302 33.839 42.402 35 42.816 L 35 45.382 L 31 47.382 L 31 51 L 29 51 L 29 42.816 C 30.161 42.402 31 41.302 31 40 C 31 38.346 29.654 37 28 37 C 26.346 37 25 38.346 25 40 C 25 41.302 25.839 42.402 27 42.816 L 27 51 L 25 51 L 25 47.382 L 21 45.382 L 21 42.816 C 22.161 42.402 23 41.302 23 40 C 23 38.346 21.654 37 20 37 C 18.346 37 17 38.346 17 40 C 17 41.302 17.839 42.402 19 42.816 L 19 46.618 L 23 48.618 L 23 51 L 15 51 L 15 35 L 41 35 L 41 51 L 39 51 M 39 51 L 38.743 53 M 38.743 53 L 40.382 53 L 43 53.005 L 43 33 L 41 33 L 41 31 L 43 31 L 43 23 L 41 23 L 41 21.103 L 43 21.103 L 43 17.831 C 43 16.177 41.654 14.831 40 14.831 C 38.346 14.831 37 16.177 37 17.831 L 37 21.103 L 39 21.103 L 39 23 L 37 23 L 37 31 L 39 31 L 39 33 L 33 33 L 33 31 L 35 31 L 35 23 L 33 23 L 33 21.103 L 35 21.103 L 35 17.831 C 35 16.177 33.654 14.831 32 14.831 C 30.346 14.831 29 16.177 29 17.831 L 29 21.103 L 31 21.103 L 31 23 L 29 23 L 29 31 L 31 31 L 31 33 L 25 33 L 25 31 L 27 31 L 27 23 L 25 23 L 25 21.103 L 27 21.103 L 27 17.831 C 27 16.177 25.654 14.831 24 14.831 C 22.346 14.831 21 16.177 21 17.831 L 21 21.103 L 23 21.103 L 23 23 L 21 23 L 21 31 L 23 31 L 23 33 L 17 33 L 17 31 L 19 31 L 19 23 L 17 23 L 17 21.103 L 19 21.103 L 19 17.831 C 19 16.177 17.654 14.831 16 14.831 C 14.346 14.831 13 16.177 13 17.831 L 13 21.103 L 15 21.103 L 15 23 L 13 23 L 13 31 L 15 31 L 15 33 L 13 33 L 13 52.974 L 15.516 53 L 37 53 M 31 17.831 C 31 17.28 31.449 16.831 32 16.831 C 32.551 16.831 33 17.28 33 17.831 L 33 19.103 L 31 19.103 L 31 17.831 Z M 31 25 L 33 25 L 33 29 L 31 29 L 31 25 Z M 23 17.831 C 23 17.28 23.449 16.831 24 16.831 C 24.551 16.831 25 17.28 25 17.831 L 25 19.103 L 23 19.103 L 23 17.831 Z M 23 25 L 25 25 L 25 29 L 23 29 L 23 25 Z M 15 17.831 C 15 17.28 15.449 16.831 16 16.831 C 16.551 16.831 17 17.28 17 17.831 L 17 19.103 L 15 19.103 L 15 17.831 Z M 15 25 L 17 25 L 17 29 L 15 29 L 15 25 Z M 36 39 C 36.551 39 37 39.449 37 40 C 37 40.551 36.551 41 36 41 C 35.449 41 35 40.551 35 40 C 35 39.449 35.449 39 36 39 Z M 28 39 C 28.551 39 29 39.449 29 40 C 29 40.551 28.551 41 28 41 C 27.449 41 27 40.551 27 40 C 27 39.449 27.449 39 28 39 Z M 20 39 C 20.551 39 21 39.449 21 40 C 21 40.551 20.551 41 20 41 C 19.449 41 19 40.551 19 40 C 19 39.449 19.449 39 20 39 Z M 41 29 L 39 29 L 39 25 L 41 25 L 41 29 Z M 41 19.103 L 39 19.103 L 39 17.831 C 39 17.28 39.449 16.831 40 16.831 C 40.551 16.831 41 17.28 41 17.831 L 41 19.103 Z");
    			add_location(path0, file, 195, 10, 25121);
    			attr_dev(path1, "d", "M 51.059 34.291 L 49.594 32.926 L 45.096 29.221 L 45 32.62 L 45 47.817 L 53.865 36.906 L 51.059 34.291 Z M 47 42.184 L 47 33.38 L 47.067 33.304 L 51.134 37.094 L 47 42.184 Z");
    			add_location(path1, file, 198, 10, 27748);
    			attr_dev(g0, "transform", "matrix(0, -1, -1, 0, 68, 68)");
    			add_location(g0, file, 194, 8, 25066);
    			attr_dev(svg0, "class", "action-icons svelte-k1qkkj");
    			attr_dev(svg0, "id", "rockIcon");
    			add_location(svg0, file, 192, 6, 24952);
    			attr_dev(button0, "class", "action-buttons svelte-k1qkkj");
    			attr_dev(button0, "id", "rockButton");
    			button0.disabled = /*animated*/ ctx[2];
    			add_location(button0, file, 183, 4, 24766);
    			add_location(desc1, file, 215, 8, 28240);
    			attr_dev(path2, "d", "M 37 103.69 L 37 101.69 M 37 101.69 L 33 101.69 L 33 99.308 L 37 97.308 L 37 93.506 C 38.161 93.092 39 91.992 39 90.69 C 39 89.036 37.654 87.69 36 87.69 C 34.346 87.69 33 89.036 33 90.69 C 33 91.992 33.839 93.092 35 93.506 L 35 96.072 L 31 98.072 L 31 101.69 L 29 101.69 L 29 93.506 C 30.161 93.092 31 91.992 31 90.69 C 31 89.036 29.654 87.69 28 87.69 C 26.346 87.69 25 89.036 25 90.69 C 25 91.992 25.839 93.092 27 93.506 L 27 101.69 L 25 101.69 L 25 98.072 L 21 96.072 L 21 93.506 C 22.161 93.092 23 91.992 23 90.69 C 23 89.036 21.654 87.69 20 87.69 C 18.346 87.69 17 89.036 17 90.69 C 17 91.992 17.839 93.092 19 93.506 L 19 97.308 L 23 99.308 L 23 101.69 L 15 101.69 L 15 85.69 L 41 85.69 L 41 101.69 L 39 101.69 M 39 101.69 L 39 103.69 M 39 103.69 L 40.382 103.69 L 43 103.639 L 43 83.69 L 41 83.69 L 41 81.69 L 43 81.69 L 43 73.69 L 41 73.69 L 41 71.69 L 43 71.69 L 43 63.69 L 41 63.69 L 41 61.69 L 43 61.69 L 43 54.69 C 43 53.036 41.654 51.69 40 51.69 L 40 51.69 C 38.346 51.69 37 53.036 37 54.69 L 37 61.69 L 39 61.69 L 39 63.69 L 37 63.69 L 37 71.69 L 39 71.69 L 39 73.69 L 37 73.69 L 37 81.69 L 39 81.69 L 39 83.69 L 33 83.69 L 33 81.69 L 35 81.69 L 35 73.69 L 33 73.69 L 33 71.69 L 35 71.69 L 35 63.69 L 33 63.69 L 33 61.69 L 35 61.69 L 35 54.69 C 35 53.036 33.654 51.69 32 51.69 C 30.346 51.69 29 53.036 29 54.69 L 29 61.69 L 31 61.69 L 31 63.69 L 29 63.69 L 29 71.69 L 31 71.69 L 31 73.69 L 29 73.69 L 29 81.69 L 31 81.69 L 31 83.69 L 25 83.69 L 25 81.69 L 27 81.69 L 27 73.69 L 25 73.69 L 25 71.69 L 27 71.69 L 27 63.69 L 25 63.69 L 25 61.69 L 27 61.69 L 27 54.69 C 27 53.036 25.654 51.69 24 51.69 C 22.346 51.69 21 53.036 21 54.69 L 21 61.69 L 23 61.69 L 23 63.69 L 21 63.69 L 21 71.69 L 23 71.69 L 23 73.69 L 21 73.69 L 21 81.69 L 23 81.69 L 23 83.69 L 17 83.69 L 17 81.69 L 19 81.69 L 19 73.69 L 17 73.69 L 17 71.69 L 19 71.69 L 19 63.69 L 17 63.69 L 17 61.69 L 19 61.69 L 19 54.69 C 19 53.036 17.654 51.69 16 51.69 C 14.346 51.69 13 53.036 13 54.69 L 13 61.69 L 15 61.69 L 15 63.69 L 13 63.69 L 13 71.69 L 15 71.69 L 15 73.69 L 13 73.69 L 13 81.69 L 15 81.69 L 15 83.69 L 13 83.69 L 13 103.697 L 15.516 103.69 L 37 103.69 M 31 54.69 C 31 54.139 31.449 53.69 32 53.69 C 32.551 53.69 33 54.139 33 54.69 L 33 59.69 L 31 59.69 L 31 54.69 Z M 31 65.69 L 33 65.69 L 33 69.69 L 31 69.69 L 31 65.69 Z M 31 75.69 L 33 75.69 L 33 79.69 L 31 79.69 L 31 75.69 Z M 23 54.69 C 23 54.139 23.449 53.69 24 53.69 C 24.551 53.69 25 54.139 25 54.69 L 25 59.69 L 23 59.69 L 23 54.69 Z M 23 65.69 L 25 65.69 L 25 69.69 L 23 69.69 L 23 65.69 Z M 23 75.69 L 25 75.69 L 25 79.69 L 23 79.69 L 23 75.69 Z M 15 54.69 C 15 54.139 15.449 53.69 16 53.69 C 16.551 53.69 17 54.139 17 54.69 L 17 59.69 L 15 59.69 L 15 54.69 Z M 15 65.69 L 17 65.69 L 17 69.69 L 15 69.69 L 15 65.69 Z M 15 75.69 L 17 75.69 L 17 79.69 L 15 79.69 L 15 75.69 Z M 36 89.69 C 36.551 89.69 37 90.139 37 90.69 C 37 91.241 36.551 91.69 36 91.69 C 35.449 91.69 35 91.241 35 90.69 C 35 90.139 35.449 89.69 36 89.69 Z M 28 89.69 C 28.551 89.69 29 90.139 29 90.69 C 29 91.241 28.551 91.69 28 91.69 C 27.449 91.69 27 91.241 27 90.69 C 27 90.139 27.449 89.69 28 89.69 Z M 20 89.69 C 20.551 89.69 21 90.139 21 90.69 C 21 91.241 20.551 91.69 20 91.69 C 19.449 91.69 19 91.241 19 90.69 C 19 90.139 19.449 89.69 20 89.69 Z M 41 79.69 L 39 79.69 L 39 75.69 L 41 75.69 L 41 79.69 Z M 41 69.69 L 39 69.69 L 39 65.69 L 41 65.69 L 41 69.69 Z M 41 59.69 L 39 59.69 L 39 54.69 C 39 54.139 39.449 53.69 40 53.69 C 40.551 53.69 41 54.139 41 54.69 L 41 59.69 Z");
    			add_location(path2, file, 217, 10, 28386);
    			attr_dev(path3, "d", "M 55.549 73.69 C 54.279 73.69 53.067 74.234 52.223 75.184 L 48.149 79.767 L 50.802 82.166 L 49.594 83.616 L 46.933 81.136 L 45 83.31 L 45 98.507 L 53.865 87.596 L 51.059 84.981 L 52.286 83.508 L 55.111 86.062 L 59.003 81.271 C 59.646 80.481 60 79.484 60 78.465 L 60 78.141 C 60 75.687 58.003 73.69 55.549 73.69 Z M 47 92.874 L 47 84.07 L 47.067 83.994 L 51.134 87.784 L 47 92.874 Z M 58 78.465 C 58 79.026 57.805 79.575 57.451 80.01 L 54.889 83.164 L 50.962 79.613 L 53.718 76.512 C 54.183 75.99 54.85 75.69 55.549 75.69 C 56.9 75.69 58 76.79 58 78.141 L 58 78.465 Z");
    			add_location(path3, file, 220, 10, 31928);
    			attr_dev(g1, "transform", "matrix(0, -1, -1, 0, 114, 68)");
    			attr_dev(g1, "bx:origin", "0.5 0.634665");
    			add_location(g1, file, 216, 8, 28305);
    			attr_dev(svg1, "class", "action-icons svelte-k1qkkj");
    			attr_dev(svg1, "id", "paperIcon");
    			add_location(svg1, file, 214, 6, 28190);
    			attr_dev(button1, "class", "action-buttons svelte-k1qkkj");
    			attr_dev(button1, "id", "paperButton");
    			button1.disabled = /*animated*/ ctx[2];
    			add_location(button1, file, 205, 4, 28002);
    			add_location(desc2, file, 237, 8, 32822);
    			attr_dev(path4, "d", "m 37,53 v -2 m 0,0 h -4 v -2.382 l 4,-2 v -3.802 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 v 2.566 l -4,2 V 51 h -2 v -8.184 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 V 51 h -2 v -3.618 l -4,-2 v -2.566 c 1.161,-0.414 2,-1.514 2,-2.816 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 0,1.302 0.839,2.402 2,2.816 v 3.802 l 4,2 V 51 H 15 V 35 h 26 v 16 h -2 m 0,0 -0.257,2 m 0,0 h 1.639 L 43,53.005 V 33 h -2 l -0.06012,-1.309104 1.969941,0.345448 1.381791,-7.879762 -1.96994,-0.345448 0.345448,-1.969941 1.96994,0.345448 1.381792,-7.879762 -1.969941,-0.345448 0.345448,-1.969941 1.969941,0.345448 1.209068,-6.8947916 C 47.859054,3.8130056 46.76577,2.2547492 45.13663,1.9690638 43.507489,1.6833783 41.949232,2.7766619 41.663547,4.4058027 l -1.209068,6.8947923 1.969941,0.345448 -0.345448,1.96994 -1.969941,-0.345448 -1.381791,7.879762 1.96994,0.345448 -0.345448,1.969941 -1.96994,-0.345448 L 37,31 38.969941,31.345448 39,33 h -6 l -0.01015,-2.284704 1.994928,-0.142351 -0.569408,-7.979711 -1.994927,0.142352 -0.142352,-1.994927 1.994928,-0.142352 -0.569408,-7.97971 -1.994927,0.142351 -0.142352,-1.994927 1.994928,-0.142352 -0.498232,-6.9822465 C 32.945308,1.9916174 31.506919,0.74483396 29.857114,0.86255891 28.207309,0.98028386 26.960526,2.4186729 27.07825,4.068478 l 0.498232,6.982246 1.994927,-0.142351 0.142352,1.994927 -1.994927,0.142352 0.569407,7.97971 1.994927,-0.142352 0.142352,1.994928 L 28.430593,23.02029 29,31 30.994928,30.857648 31,33 h -6 v -1.827 h 2 v -7 c 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 v 7 h 2 V 33 h -6 v -1.827 h 2 v -7 c 0,-1.654 -1.346,-3 -3,-3 -1.654,0 -3,1.346 -3,3 v 7 h 2 V 33 H 13 V 52.974 L 15.516,53 H 37 M 29.073178,3.9261262 c -0.03922,-0.5496026 0.376685,-1.0294218 0.926288,-1.0686397 0.549602,-0.039218 1.029422,0.3766853 1.06864,0.9262878 l 0.355879,4.9873189 -1.994927,0.1423518 z m 0.782935,10.9721018 1.994928,-0.142352 0.284703,3.989855 -1.994927,0.142352 z m 0.711759,9.974638 1.994928,-0.142352 0.284703,3.989855 -1.994927,0.142352 z M 23,24.173 c 0,-0.551 0.449,-1 1,-1 0.551,0 1,0.449 1,1 v 5 h -2 z m -8,0 c 0,-0.551 0.449,-1 1,-1 0.551,0 1,0.449 1,1 v 5 H 15 Z M 36,39 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m -8,0 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m -8,0 c 0.551,0 1,0.449 1,1 0,0.551 -0.449,1 -1,1 -0.551,0 -1,-0.449 -1,-1 0,-0.551 0.449,-1 1,-1 z m 21.285329,-9.279045 -1.969941,-0.345448 0.690896,-3.939881 1.969941,0.345448 z m 1.72724,-9.849702 -1.969941,-0.345448 0.690896,-3.939881 1.96994,0.345448 z m 1.727239,-9.849703 -1.96994,-0.345448 0.863619,-4.9248514 c 0.09517,-0.5427186 0.614976,-0.9074172 1.157695,-0.8122463 0.542718,0.095171 0.907417,0.6149756 0.812246,1.1576942 z");
    			attr_dev(path4, "sodipodi:nodetypes", "cccccccsssccccccsssccccccsssccccccccccccccccccccccccccsssccccccccccccccccccccccsssccccccccccccccsssccccccssscccccccsssccsccccccccccsssccssssccssssssssssssssssccccccccccccsssc");
    			add_location(path4, file, 239, 10, 32942);
    			attr_dev(path5, "d", "M 51.059 34.291 L 49.594 32.926 L 45.042 29.059 L 45 32.62 L 45 47.817 L 53.865 36.906 L 51.059 34.291 Z M 47 42.184 L 47 33.38 L 47.067 33.304 L 51.134 37.094 L 47 42.184 Z");
    			add_location(path5, file, 243, 10, 36095);
    			attr_dev(g2, "transform", "matrix(0, -1, -1, 0, 65, 68)");
    			add_location(g2, file, 238, 8, 32887);
    			attr_dev(svg2, "class", "action-icons svelte-k1qkkj");
    			attr_dev(svg2, "id", "scissorsIcon");
    			add_location(svg2, file, 236, 6, 32769);
    			attr_dev(button2, "class", "action-buttons svelte-k1qkkj");
    			attr_dev(button2, "id", "scissorsButton");
    			button2.disabled = /*animated*/ ctx[2];
    			add_location(button2, file, 227, 4, 32575);
    			attr_dev(div9, "class", "buttons-container");
    			attr_dev(div9, "id", "buttonsContainer");
    			add_location(div9, file, 182, 2, 24708);
    			attr_dev(main, "class", "svelte-k1qkkj");
    			add_location(main, file, 60, 0, 1195);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(main, t3);
    			append_dev(main, div3);
    			append_dev(div3, div0);
    			if_block0.m(div0, null);
    			append_dev(div3, t4);
    			append_dev(div3, div1);
    			append_dev(div1, p1);
    			append_dev(div3, t6);
    			append_dev(div3, div2);
    			if_block1.m(div2, null);
    			append_dev(main, t7);
    			append_dev(main, div8);
    			append_dev(div8, div4);
    			append_dev(div4, span0);
    			append_dev(div4, t8);
    			append_dev(div4, span1);
    			append_dev(div4, t9);
    			append_dev(div4, span2);
    			append_dev(div8, t10);
    			append_dev(div8, div6);
    			append_dev(div6, div5);
    			append_dev(div5, p2);
    			append_dev(p2, t11);
    			append_dev(div5, t12);
    			append_dev(div5, p3);
    			append_dev(p3, t13);
    			append_dev(p3, t14);
    			append_dev(p3, t15);
    			append_dev(div8, t16);
    			append_dev(div8, div7);
    			append_dev(div7, span3);
    			append_dev(div7, t17);
    			append_dev(div7, span4);
    			append_dev(div7, t18);
    			append_dev(div7, span5);
    			append_dev(main, t19);
    			append_dev(main, div9);
    			append_dev(div9, button0);
    			append_dev(button0, svg0);
    			append_dev(svg0, desc0);
    			append_dev(desc0, t20);
    			append_dev(svg0, g0);
    			append_dev(g0, path0);
    			append_dev(g0, path1);
    			append_dev(div9, t21);
    			append_dev(div9, button1);
    			append_dev(button1, svg1);
    			append_dev(svg1, desc1);
    			append_dev(desc1, t22);
    			append_dev(svg1, g1);
    			append_dev(g1, path2);
    			append_dev(g1, path3);
    			append_dev(div9, t23);
    			append_dev(div9, button2);
    			append_dev(button2, svg2);
    			append_dev(svg2, desc2);
    			append_dev(desc2, t24);
    			append_dev(svg2, g2);
    			append_dev(g2, path4);
    			append_dev(g2, path5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "animationend", /*animationend_handler*/ ctx[8], false, false, false),
    					listen_dev(button0, "click", /*click_handler*/ ctx[9], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[10], false, false, false),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			}

    			if (dirty & /*animated*/ 4 && div0_class_value !== (div0_class_value = "play-icon-container " + (/*animated*/ ctx[2] ? 'shaking' : '') + " svelte-k1qkkj")) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (current_block_type_1 !== (current_block_type_1 = select_block_type_1(ctx))) {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div2, null);
    				}
    			}

    			if (dirty & /*animated*/ 4 && div2_class_value !== (div2_class_value = "play-icon-container " + (/*animated*/ ctx[2] ? 'shaking' : '') + " svelte-k1qkkj")) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty & /*result*/ 32) set_data_dev(t11, /*result*/ ctx[5]);
    			if (dirty & /*playerScore*/ 1) set_data_dev(t13, /*playerScore*/ ctx[0]);
    			if (dirty & /*computerScore*/ 2) set_data_dev(t15, /*computerScore*/ ctx[1]);

    			if (dirty & /*animated*/ 4) {
    				prop_dev(button0, "disabled", /*animated*/ ctx[2]);
    			}

    			if (dirty & /*animated*/ 4) {
    				prop_dev(button1, "disabled", /*animated*/ ctx[2]);
    			}

    			if (dirty & /*animated*/ 4) {
    				prop_dev(button2, "disabled", /*animated*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block0.d();
    			if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getComputerChoice() {
    	let play = Math.random();

    	play = play < 0.33
    	? 'rock'
    	: play > 0.66 ? 'paper' : 'scissors';

    	return play;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let playerScore = 0;
    	let computerScore = 0;
    	let newGame = true;
    	let animated = false;
    	let player = 'rock';
    	let computer = 'rock';
    	let result = '';
    	let playerChoice;

    	function playRound() {
    		$$invalidate(2, animated = false);
    		if (newGame) initNewGame();
    		$$invalidate(3, player = playerChoice);
    		$$invalidate(4, computer = getComputerChoice());
    		$$invalidate(5, result = compare(player, computer));
    		checkGameOver();
    	}

    	function initNewGame() {
    		$$invalidate(0, playerScore = 0);
    		$$invalidate(1, computerScore = 0);
    		newGame = false;
    	}

    	function compare(p, c) {
    		if (p === c) {
    			return 'draw';
    		} else if (p === 'rock' && c === 'scissors' || p === 'paper' && c === 'rock' || p === 'scissors' && c === 'paper') {
    			$$invalidate(0, playerScore++, playerScore);
    			return '<<<';
    		} else {
    			$$invalidate(1, computerScore++, computerScore);
    			return '>>>';
    		}
    	}

    	function checkGameOver() {
    		if (playerScore === 3) {
    			$$invalidate(5, result = 'you win!');
    			newGame = true;
    		} else if (computerScore === 3) {
    			$$invalidate(5, result = 'you lose!');
    			newGame = true;
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const animationend_handler = () => playRound();

    	const click_handler = () => {
    		$$invalidate(2, animated = true);
    		$$invalidate(6, playerChoice = 'rock');
    	};

    	const click_handler_1 = () => {
    		$$invalidate(2, animated = true);
    		$$invalidate(6, playerChoice = 'paper');
    	};

    	const click_handler_2 = () => {
    		$$invalidate(2, animated = true);
    		$$invalidate(6, playerChoice = 'scissors');
    	};

    	$$self.$capture_state = () => ({
    		playerScore,
    		computerScore,
    		newGame,
    		animated,
    		player,
    		computer,
    		result,
    		playerChoice,
    		getComputerChoice,
    		playRound,
    		initNewGame,
    		compare,
    		checkGameOver
    	});

    	$$self.$inject_state = $$props => {
    		if ('playerScore' in $$props) $$invalidate(0, playerScore = $$props.playerScore);
    		if ('computerScore' in $$props) $$invalidate(1, computerScore = $$props.computerScore);
    		if ('newGame' in $$props) newGame = $$props.newGame;
    		if ('animated' in $$props) $$invalidate(2, animated = $$props.animated);
    		if ('player' in $$props) $$invalidate(3, player = $$props.player);
    		if ('computer' in $$props) $$invalidate(4, computer = $$props.computer);
    		if ('result' in $$props) $$invalidate(5, result = $$props.result);
    		if ('playerChoice' in $$props) $$invalidate(6, playerChoice = $$props.playerChoice);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		playerScore,
    		computerScore,
    		animated,
    		player,
    		computer,
    		result,
    		playerChoice,
    		playRound,
    		animationend_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
