import React from 'react';
import PropTypes from 'prop-types';
import serialize from 'form-serialize';
import ga from 'google-analytics';
import _ from 'underscore';
import url from 'url';
import jsonScriptEscape from '../libs/jsonScriptEscape';
import origin from '../libs/origin';
import { BrowserFeat } from './browserfeat';
import * as globals from './globals';
import Navigation from './navigation';
import Footer from './footer';


const portal = {
    portal_title: 'RegulomeDB',
    global_sections: [
        {
            id: 'data',
            title: 'Data',
            children: [
                { id: 'experiments', title: 'Experiments', url: 'https://www.encodeproject.org/search/?type=Experiment&internal_tags=RegulomeDB_2_0' },
                { id: 'annotations', title: 'Annotations', url: 'https://www.encodeproject.org/search/?type=Annotation&internal_tags=RegulomeDB_2_0' },
            ],
        },
        {
            id: 'regulomehelp',
            title: 'Help',
            url: 'regulome-help',
        },
    ],
};


// See https://github.com/facebook/react/issues/2323 for an IE8 fix removed for Redmine #4755.
const Title = props => <title {...props}>{props.children}</title>;

Title.propTypes = {
    children: PropTypes.node.isRequired,
};


// Get the current browser cookie from the DOM.
function extractSessionCookie() {
    const cookie = require('cookie-monster');
    return cookie(document).get('session');
}


function contentTypeIsJSON(contentType) {
    return (contentType || '').split(';')[0].split('/').pop().split('+').pop() === 'json';
}


// Extract the current session information from the current browser cookie.
function parseSessionCookie(sessionCookie) {
    const buffer = require('buffer').Buffer;
    let session;
    if (sessionCookie) {
        // URL-safe base64
        const mutatedSessionCookie = sessionCookie.replace(/-/g, '+').replace(/_/g, '/');
        // First 64 chars is the sha-512 server signature
        // Payload is [accessed, created, data]
        try {
            session = JSON.parse(buffer(mutatedSessionCookie, 'base64').slice(64).toString())[2];
        } catch (e) {
            console.warn('session parse err %o', session);
        }
    }
    return session || {};
}


function recordServerStats(serverStats, timingVar) {
    // server_stats *_time are microsecond values...
    Object.keys(serverStats).forEach((name) => {
        if (name.indexOf('_time') !== -1) {
            ga('send', 'timing', {
                timingCategory: name,
                timingVar,
                timingValue: Math.round(serverStats[name] / 1000),
            });
        }
    });
}


function recordBrowserStats(browserStats, timingVar) {
    Object.keys(browserStats).forEach((name) => {
        if (name.indexOf('_time') !== -1) {
            ga('send', 'timing', {
                timingCategory: name,
                timingVar,
                timingValue: browserStats[name],
            });
        }
    });
}


class UnsavedChangesToken {
    constructor(manager) {
        this.manager = manager;
    }

    release() {
        this.manager.releaseUnsavedChanges(this);
    }
}


const SLOW_REQUEST_TIME = 250;
class Timeout {
    constructor(timeout) {
        this.promise = new Promise(resolve => setTimeout(resolve.bind(undefined, this), timeout));
    }
}


// App is the root component, mounted on document.body.
// It lives for the entire duration the page is loaded.
// App maintains state for the
class App extends React.Component {
    static historyEnabled() {
        return !!(typeof window !== 'undefined' && window.history && window.history.pushState);
    }

    static scrollTo() {
        const hash = window.location.hash;
        if (hash && document.getElementById(hash.slice(1))) {
            window.location.replace(hash);
        } else {
            window.scrollTo(0, 0);
        }
    }

    constructor(props) {
        super();
        this.state = {
            href: props.href, // Current URL bar
            slow: false, // `true` if we expect response from server, but it seems slow
            errors: [],
            assayTermNameColors: null,
            context: props.context,
            session: null,
            session_properties: {},
            session_cookie: '',
            profilesTitles: {},
            contextRequest: null,
            unsavedChanges: [],
            promisePending: false,
        };

        // Bind this to non-React methods.
        this.fetch = this.fetch.bind(this);
        this.fetchSessionProperties = this.fetchSessionProperties.bind(this);
        this.adviseUnsavedChanges = this.adviseUnsavedChanges.bind(this);
        this.releaseUnsavedChanges = this.releaseUnsavedChanges.bind(this);
        this.trigger = this.trigger.bind(this);
        this.handleError = this.handleError.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
        this.confirmNavigation = this.confirmNavigation.bind(this);
        this.navigate = this.navigate.bind(this);
        this.receiveContextResponse = this.receiveContextResponse.bind(this);
        this.listActionsFor = this.listActionsFor.bind(this);
        this.currentResource = this.currentResource.bind(this);
        this.currentAction = this.currentAction.bind(this);
    }

    // Data for child components to subscrie to.
    getChildContext() {
        return {
            listActionsFor: this.listActionsFor,
            currentResource: this.currentResource,
            location_href: this.state.href,
            portal,
            fetch: this.fetch,
            fetchSessionProperties: this.fetchSessionProperties,
            navigate: this.navigate,
            adviseUnsavedChanges: this.adviseUnsavedChanges,
            session: this.state.session,
            session_properties: this.state.session_properties,
            profilesTitles: this.state.profilesTitles,
            localInstance: url.parse(this.props.href).hostname === 'localhost',
        };
    }

    /* eslint new-cap: ["error", { "properties": false }] */
    componentDidMount() {
        // Login / logout actions must be deferred until Auth0 is ready.
        const sessionCookie = extractSessionCookie();
        const session = parseSessionCookie(sessionCookie);
        this.setState({
            href: window.location.href,
            session_cookie: sessionCookie,
            session,
        });

        // Set browser features in the <html> CSS class.
        BrowserFeat.setHtmlFeatClass();

        // Initialize browesr history mechanism
        if (this.constructor.historyEnabled()) {
            const data = this.props.context;
            try {
                window.history.replaceState(data, '', window.location.href);
            } catch (exc) {
                // Might fail due to too large data
                window.history.replaceState(null, '', window.location.href);
            }

            // If it looks like an anchor target link, scroll to it, plus an offset for the fixed navbar
            // Hints from https://dev.opera.com/articles/fixing-the-scrolltop-bug/
            if (window.location.href) {
                const splitHref = this.state.href.split('#');
                if (splitHref.length >= 2 && splitHref[1][0] !== '!') {
                    // URL has hash tag, but not the '#!edit' type
                    const hashTarget = splitHref[1];
                    const domTarget = document.getElementById(hashTarget);
                    if (domTarget) {
                        // DOM has a matching anchor; scroll to it
                        const elTop = domTarget.getBoundingClientRect().top;
                        const docTop = document.documentElement.scrollTop || document.body.scrollTop;
                        const scrollTop = (elTop + docTop) - (window.innerWidth >= 960 ? 75 : 0);
                        document.documentElement.scrollTop = scrollTop;
                        document.body.scrollTop = scrollTop;
                    }
                }
            }

            // Avoid popState on load, see: http://stackoverflow.com/q/6421769/199100
            const register = window.addEventListener.bind(window, 'popstate', this.handlePopState, true);
            if (window._onload_event_fired) {
                register();
            } else {
                window.addEventListener('load', setTimeout.bind(window, register));
            }
        } else {
            window.onhashchange = this.onHashChange;
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextState) {
            return !(_.isEqual(nextState, this.state));
        }
        return false;
    }

    componentDidUpdate(prevProps, prevState) {
        if (!this.state.session || (this.state.session_cookie !== prevState.session_cookie)) {
            const updateState = {};
            updateState.session = parseSessionCookie(this.state.session_cookie);
            this.setState(updateState);
        }

        if (this.props) {
            Object.keys(this.props).forEach((propKey) => {
                if (this.props[propKey] !== prevProps[propKey]) {
                    console.log('changed props: %s', propKey);
                }
            });
        }
        if (this.state) {
            Object.keys(this.state).forEach((stateKey) => {
                if (this.state[stateKey] !== prevState[stateKey]) {
                    console.log('changed state: %s', stateKey);
                }
            });
        }

        const xhr = this.state.contextRequest;
        if (!xhr || !xhr.xhr_end || xhr.browser_stats) {
            return;
        }
        const browserEnd = 1 * new Date();

        ga('set', 'location', window.location.href);
        ga('send', 'pageview');
        recordServerStats(xhr.server_stats, 'contextRequest');

        xhr.browser_stats = {};
        xhr.browser_stats.xhr_time = xhr.xhr_end - xhr.xhr_begin;
        xhr.browser_stats.browser_time = browserEnd - xhr.xhr_end;
        xhr.browser_stats.total_time = browserEnd - xhr.xhr_begin;
        recordBrowserStats(xhr.browser_stats, 'contextRequest');
    }

    onHashChange() {
        // IE8/9
        this.setState({ href: window.location.href });
    }

    // Handle http requests to the server, using the given URL and options.
    fetch(uri, options) {
        let reqUri = uri;
        const extendedOptions = _.extend({ credentials: 'same-origin' }, options);
        const httpMethod = extendedOptions.method || 'GET';
        if (!(httpMethod === 'GET' || httpMethod === 'HEAD')) {
            const headers = _.extend({}, extendedOptions.headers);
            extendedOptions.headers = headers;
            const session = this.state.session;
            if (session && session._csrft_) {
                headers['X-CSRF-Token'] = session._csrft_;
            }
        }
        // Strip url fragment.
        const urlHash = reqUri.indexOf('#');
        if (urlHash > -1) {
            reqUri = reqUri.slice(0, urlHash);
        }
        const request = fetch(reqUri, extendedOptions);
        request.xhr_begin = 1 * new Date();
        request.then((response) => {
            request.xhr_end = 1 * new Date();
            const statsHeader = response.headers.get('X-Stats') || '';
            request.server_stats = require('querystring').parse(statsHeader);
            request.etag = response.headers.get('ETag');
            const sessionCookie = extractSessionCookie();
            if (this.state.session_cookie !== sessionCookie) {
                this.setState({ session_cookie: sessionCookie });
            }
        });
        return request;
    }

    fetchSessionProperties() {
        if (this.sessionPropertiesRequest) {
            return;
        }
        this.sessionPropertiesRequest = true;
        this.fetch('/session-properties', {
            headers: { Accept: 'application/json' },
        }).then((response) => {
            this.sessionPropertiesRequest = null;
            if (!response.ok) {
                throw response;
            }
            return response.json();
        }).then((sessionProperties) => {
            this.setState({ session_properties: sessionProperties });
        });
    }

    adviseUnsavedChanges() {
        const token = new UnsavedChangesToken(this);
        this.setState({ unsavedChanges: this.state.unsavedChanges.concat([token]) });
        return token;
    }

    releaseUnsavedChanges(token) {
        console.assert(this.state.unsavedChanges.indexOf(token) !== -1);
        this.setState({ unsavedChanges: this.state.unsavedChanges.filter(x => x !== token) });
    }

    trigger(name) {
        const methodName = this.triggers[name];
        if (methodName) {
            this[methodName].call(this);
        }
    }

    handleError(msg, uri, line, column) {
        let mutatableUri = uri;

        // When an unhandled exception occurs, reload the page on navigation
        this.constructor.historyEnabled = false;
        const parsed = mutatableUri && require('url').parse(mutatableUri);
        if (mutatableUri && parsed.hostname === window.location.hostname) {
            mutatableUri = parsed.path;
        }
        ga('send', 'exception', {
            exDescription: `${mutatableUri}@${line},${column}: ${msg}`,
            exFatal: true,
            location: window.location.href,
        });
    }

    /* eslint no-script-url: 0 */ // We're not *using* a javascript: link -- just checking them.
    handleClick(event) {
        // https://github.com/facebook/react/issues/1691
        if (event.isDefaultPrevented()) {
            return;
        }

        let target = event.target;
        const nativeEvent = event.nativeEvent;

        // SVG anchor elements have tagName == 'a' while HTML anchor elements have tagName == 'A'
        while (target && (target.tagName.toLowerCase() !== 'a' || target.getAttribute('data-href'))) {
            target = target.parentElement;
        }
        if (!target) {
            return;
        }

        if (target.getAttribute('disabled')) {
            event.preventDefault();
            return;
        }

        // data-trigger links invoke custom handlers.
        const dataTrigger = target.getAttribute('data-trigger');
        if (dataTrigger !== null) {
            event.preventDefault();
            this.trigger(dataTrigger);
            return;
        }

        // Ensure this is a plain click
        if (nativeEvent.which > 1 || nativeEvent.shiftKey || nativeEvent.altKey || nativeEvent.metaKey) {
            return;
        }

        // Skip links with a data-bypass attribute.
        if (target.getAttribute('data-bypass')) {
            return;
        }

        let href = target.getAttribute('href');
        if (href === null) {
            href = target.getAttribute('data-href');
        }
        if (href === null) {
            return;
        }

        // Skip javascript links
        if (href.indexOf('javascript:') === 0) {
            return;
        }

        // Skip external links
        if (!origin.same(href)) {
            return;
        }

        // Skip links with a different target
        if (target.getAttribute('target')) {
            return;
        }

        // Skip @@download links
        if (href.indexOf('/@@download') !== -1) {
            return;
        }

        // With HTML5 history supported, local navigation is passed
        // through the navigate method.
        if (this.constructor.historyEnabled) {
            event.preventDefault();
            this.navigate(href);
        }
    }

    // Submitted forms are treated the same as links
    handleSubmit(event) {
        const target = event.target;

        // Skip POST forms
        if (target.method !== 'get') {
            return;
        }

        // Skip forms with a data-bypass attribute.
        if (target.getAttribute('data-bypass')) {
            return;
        }

        // Skip external forms
        if (!origin.same(target.action)) {
            return;
        }

        const options = {};
        let search = serialize(target);

        if (target.getAttribute('data-removeempty')) {
            search = search.split('&').filter(item => item.slice(-1) !== '=').join('&');
        }

        let href = '/regulome-summary/';
        if (search) {
            href += `?${search}`;
        }
        options.skipRequest = target.getAttribute('data-skiprequest');

        if (this.constructor.historyEnabled) {
            event.preventDefault();
            this.navigate(href, options);
        }
    }

    handlePopState(event) {
        if (this.DISABLE_POPSTATE) {
            return;
        }
        if (!this.confirmNavigation()) {
            window.history.pushState(window.state, '', this.state.href);
            return;
        }
        if (!this.constructor.historyEnabled) {
            window.location.reload();
            return;
        }
        const request = this.state.contextRequest;
        const href = window.location.href;
        if (event.state) {
            // Abort inflight xhr before setProps
            if (request && this.requestCurrent) {
                // Abort the current request, then remember we've aborted it so that we don't render
                // the Network Request Error page.
                request.abort();
                this.requestAborted = true;
                this.requestCurrent = false;
            }
            this.setState({
                href, // href should be consistent with context
                context: event.state,
            });
        }
        // Always async update in case of server side changes.
        // Triggers standard analytics handling.
        this.navigate(href, { replace: true });
    }

    /* eslint no-alert: 0 */
    confirmNavigation() {
        // check for beforeunload confirmation
        if (this.state.unsavedChanges.length) {
            const res = window.confirm('You have unsaved changes. Are you sure you want to lose them?');
            if (res) {
                this.setState({ unsavedChanges: [] });
            }
            return res;
        }
        return true;
    }

    navigate(href, options) {
        const mutatableOptions = options || {};
        if (!this.confirmNavigation()) {
            return null;
        }

        // options.skipRequest only used by collection search form
        // options.replace only used handleSubmit, handlePopState, handleAuth0Login
        let mutatableHref = url.resolve(this.state.href, href);

        // Strip url fragment.
        let fragment = '';
        const hrefHashPos = mutatableHref.indexOf('#');
        if (hrefHashPos > -1) {
            fragment = mutatableHref.slice(hrefHashPos);
            mutatableHref = mutatableHref.slice(0, hrefHashPos);
        }

        // Bypass loading and rendering from JSON if history is disabled
        // or if the href looks like a download.
        let decodedHref;
        try {
            decodedHref = decodeURIComponent(mutatableHref);
        } catch (exc) {
            decodedHref = mutatableHref;
        }
        const isDownload = decodedHref.includes('/@@download') || decodedHref.includes('/batch_download/');
        if (!this.constructor.historyEnabled() || isDownload) {
            this.fallbackNavigate(mutatableHref, fragment, mutatableOptions);
            return null;
        }

        let request = this.state.contextRequest;

        if (request && this.requestCurrent) {
            // Abort the current request, then remember we've aborted the request so that we
            // don't render the Network Request Error page.
            request.abort();
            this.requestAborted = true;
            this.requestCurrent = false;
        }

        if (mutatableOptions.skipRequest) {
            if (mutatableOptions.replace) {
                window.history.replaceState(window.state, '', mutatableHref + fragment);
            } else {
                window.history.pushState(window.state, '', mutatableHref + fragment);
            }
            this.setState({ href: mutatableHref + fragment });
            return null;
        }

        request = this.fetch(mutatableHref, {
            headers: { Accept: 'application/json' },
        });
        this.requestCurrent = true; // Remember we have an outstanding GET request

        const timeout = new Timeout(SLOW_REQUEST_TIME);

        Promise.race([request, timeout.promise]).then((v) => {
            if (v instanceof Timeout) {
                this.setState({ slow: true });
            } else {
                // Request has returned data
                this.requestCurrent = false;
            }
        });

        const promise = request.then((response) => {
            // Request has returned data
            this.requestCurrent = false;

            // navigate normally to URL of unexpected non-JSON response so back button works.
            if (!contentTypeIsJSON(response.headers.get('Content-Type'))) {
                this.fallbackNavigate(mutatableHref, fragment, mutatableOptions);
                return null;
            }
            // The URL may have redirected
            const responseUrl = (response.url || mutatableHref) + fragment;
            if (mutatableOptions.replace) {
                window.history.replaceState(null, '', responseUrl);
            } else {
                window.history.pushState(null, '', responseUrl);
            }
            this.setState({
                href: responseUrl,
            });
            if (!response.ok) {
                throw response;
            }
            return response.json();
        }).catch(globals.parseAndLogError.bind(undefined, 'contextRequest')).then(this.receiveContextResponse);

        if (!mutatableOptions.replace) {
            promise.then(this.constructor.scrollTo);
        }

        this.setState({
            contextRequest: request,
        });
        return request;
    }

    /* eslint-disable class-methods-use-this */
    fallbackNavigate(href, fragment, options) {
        // Navigate using window.location
        if (options.replace) {
            window.location.replace(href + fragment);
        } else {
            const oldPath = (window.location.toString()).split('#')[0];
            window.location.assign(href + fragment);
            if (oldPath === href) {
                window.location.reload();
            }
        }
    }
    /* eslint-enable class-methods-use-this */

    receiveContextResponse(data) {
        // title currently ignored by browsers
        try {
            window.history.replaceState(data, '', window.location.href);
        } catch (exc) {
            // Might fail due to too large data
            window.history.replaceState(null, '', window.location.href);
        }

        // Set up new properties for the page after a navigation click. First disable slow now that we've
        // gotten a response. If the requestAborted flag is set, then a request was aborted and so we have
        // the data for a Network Request Error. Don't render that, but clear the requestAboerted flag.
        // Otherwise we have good page data to render.
        const newState = { slow: false };
        if (!this.requestAborted) {
            // Real page to render
            this.setState({ context: data });
        } else {
            // data holds network error. Don't render that, but clear the requestAborted flag so we're ready
            // for the next navigation click.
            this.requestAborted = false;
        }
        this.setState(newState);
    }

    listActionsFor(category) {
        if (category === 'context') {
            let context = this.currentResource();
            const name = this.currentAction();
            const contextActions = [];
            Array.prototype.push.apply(contextActions, context.actions || []);
            if (!name && context.default_page) {
                context = context.default_page;
                const actions = context.actions || [];
                for (let i = 0; i < actions.length; i += 1) {
                    const action = actions[i];
                    if (action.href[0] === '#') {
                        action.href = context['@id'] + action.href;
                    }
                    contextActions.push(action);
                }
            }
            return contextActions;
        }
        if (category === 'user') {
            return this.state.session_properties.user_actions || [];
        }
        if (category === 'global_sections') {
            return portal.global_sections;
        }
        return null;
    }

    currentResource() {
        return this.state.context;
    }

    currentAction() {
        const hrefUrl = url.parse(this.state.href);
        const hash = hrefUrl.hash || '';
        let name = '';
        if (hash.slice(0, 2) === '#!') {
            name = hash.slice(2);
        }
        return name;
    }

    render() {
        console.log('render app');
        let content;
        let containerClass;
        let context = this.state.context;
        const hrefUrl = url.parse(this.state.href);
        // Switching between collections may leave component in place
        const key = context && context['@id'] && context['@id'].split('?')[0];
        const currentAction = this.currentAction();
        const isHomePage = null;
        if (!currentAction && context.default_page) {
            context = context.default_page;
        }
        if (context) {
            const ContentView = globals.contentViews.lookup(context, currentAction);
            content = <ContentView context={context} />;
            containerClass = 'container';
        }
        const errors = this.state.errors.map(i => <div key={i} className="alert alert-error" />);

        let appClass = 'done';
        if (this.state.slow) {
            appClass = 'communicating';
        }

        let title = context.title || context.name || context.accession || context['@id'];
        if (title && title !== 'Home') {
            title = `${title} – ${portal.portal_title}`;
        } else {
            title = portal.portal_title;
        }

        let canonical = this.state.href;
        if (context.canonical_uri) {
            if (hrefUrl.host) {
                canonical = `${hrefUrl.protocol || ''}//${hrefUrl.host + context.canonical_uri}`;
            } else {
                canonical = context.canonical_uri;
            }
        }

        // Google does not update the content of 301 redirected pages
        let base;
        if (({ 'http://www.encodeproject.org/': 1, 'http://encodeproject.org/': 1 })[canonical]) {
            base = 'https://www.encodeproject.org/';
            canonical = base;
            this.constructor.historyEnabled = false;
        }

        /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
        return (
            <html lang="en" ref={this.props.domReader ? node => this.props.domReader(node) : null}>
                <head>
                    <meta charSet="utf-8" />
                    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <Title>{title}</Title>
                    {base ? <base href={base} /> : null}
                    <link rel="canonical" href={canonical} />
                    <script async src="//www.google-analytics.com/analytics.js" />
                    <link rel="shortcut icon" href="/static/img/favicon.ico?7" type="image/x-icon" />
                    {this.props.inline ? <script data-prop-name="inline" dangerouslySetInnerHTML={{ __html: this.props.inline }} /> : null}
                    {this.props.styles ? <link rel="stylesheet" href={this.props.styles} /> : null}
                    <link href="https://fonts.googleapis.com/css?family=Khula:300,400,600,700,800" rel="stylesheet" />
                </head>
                <body onClick={this.handleClick} onSubmit={this.handleSubmit}>
                    <script
                        data-prop-name="context"
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                            __html: `\n\n${jsonScriptEscape(JSON.stringify(this.state.context))}\n\n`,
                        }}
                    />
                    <div id="slot-application">
                        <div id="application" className={appClass}>
                            <div className="loading-spinner">
                                <div className="loading-spinner-circle">
                                    <img src="/static/img/spinner1.gif" alt="Still loading..." />
                                </div>
                            </div>
                            <div id="layout">
                                <Navigation isHomePage={isHomePage} />
                                <div id="content" className={containerClass} key={key}>
                                    {content}
                                </div>
                                {errors}
                                <div id="layout-footer" />
                            </div>
                            <Footer version={this.props.context.app_version} />
                        </div>
                    </div>
                </body>
            </html>
        );
        /* eslint-enable jsx-a11y/click-events-have-key-events */
    }
}

App.propTypes = {
    context: PropTypes.object.isRequired,
    href: PropTypes.string.isRequired,
    styles: PropTypes.string,
    inline: PropTypes.string,
    domReader: PropTypes.func, // Only for Jest test
};

App.defaultProps = {
    styles: '',
    inline: '',
    domReader: null,
};

App.childContextTypes = {
    listActionsFor: PropTypes.func,
    currentResource: PropTypes.func,
    location_href: PropTypes.string,
    fetch: PropTypes.func,
    fetchSessionProperties: PropTypes.func,
    navigate: PropTypes.func,
    portal: PropTypes.object,
    projectColors: PropTypes.object,
    biosampleTypeColors: PropTypes.object,
    adviseUnsavedChanges: PropTypes.func,
    session: PropTypes.object,
    session_properties: PropTypes.object,
    profilesTitles: PropTypes.object,
    localInstance: PropTypes.bool,
};

module.exports = App;


// Only used for Jest tests.
module.exports.getRenderedProps = function getRenderedProps(document) {
    const props = {};

    // Ensure the initial render is exactly the same
    props.href = document.querySelector('link[rel="canonical"]').getAttribute('href');
    props.styles = document.querySelector('link[rel="stylesheet"]').getAttribute('href');
    const scriptProps = document.querySelectorAll('script[data-prop-name]');
    for (let i = 0; i < scriptProps.length; i += 1) {
        const elem = scriptProps[i];
        let value = elem.text;
        const elemType = elem.getAttribute('type') || '';
        if (elemType === 'application/json' || elemType.slice(-5) === '+json') {
            value = JSON.parse(value);
        }
        props[elem.getAttribute('data-prop-name')] = value;
    }
    return props;
};
