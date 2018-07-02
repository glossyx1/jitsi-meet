// @flow

import {
    CONFERENCE_FAILED,
    CONFERENCE_JOINED,
    CONFERENCE_LEFT,
    CONFERENCE_WILL_JOIN,
    CONFERENCE_WILL_LEAVE,
    JITSI_CONFERENCE_URL_KEY,
    isRoomValid
} from '../../base/conference';
import {
    CONNECTION_DISCONNECTED,
    CONNECTION_FAILED,
    CONNECTION_WILL_CONNECT
} from '../../base/connection';
import {
    MiddlewareRegistry,
    toState
} from '../../base/redux';
import { parseURIString, toURLString } from '../../base/util';

import {
    SESSION_FAILED,
    SESSION_WILL_END,
    SESSION_ENDED,
    SESSION_WILL_START,
    SESSION_STARTED
} from './constants';
import { setSession } from './actions';
import { CONFIG_WILL_LOAD, LOAD_CONFIG_ERROR } from '../config';
import { getCurrentSession } from './functions';

/**
 * Middleware that captures Redux actions and uses the ExternalAPI module to
 * turn them into native events so the application knows about them.
 *
 * @param {Store} store - Redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(store => next => action => {
    const result = next(action);
    const { type } = action;

    switch (type) {
    case CONFERENCE_WILL_JOIN: {
        const { conference } = action;
        const url = toURLString(conference[JITSI_CONFERENCE_URL_KEY]);
        const session = _getSessionForConferenceAction(store, action);

        if (session) {
            store.dispatch(setSession({
                url: session.url,
                conference
            }));
        } else {
            console.info(`IGNORED WILL_JOIN FOR: ${url}`);
        }
        break;
    }
    case CONFERENCE_JOINED: {
        const { conference } = action;
        const url = toURLString(conference[JITSI_CONFERENCE_URL_KEY]);
        const session = _getSessionForConferenceAction(store, action);
        const state = session && session.state;

        if (state === SESSION_WILL_START
                && session.conference === conference) {
            store.dispatch(
                setSession({
                    url,
                    state: SESSION_STARTED
                }));
        } else {
            console.info(`IGNORED CONF JOINED FOR: ${url}`);
        }
        break;
    }
    case CONFERENCE_LEFT:
    case CONFERENCE_FAILED: {
        const { conference, error } = action;
        const url = toURLString(conference[JITSI_CONFERENCE_URL_KEY]);
        const session = _getSessionForConferenceAction(store, action);

        // XXX Certain CONFERENCE_FAILED errors are recoverable i.e. they have
        // prevented the user from joining a specific conference but the app may
        // be able to eventually join the conference. For example, the app will
        // ask the user for a password upon
        // JitsiConferenceErrors.PASSWORD_REQUIRED and will retry joining the
        // conference afterwards. Such errors are to not reach the native
        // counterpart of the External API (or at least not in the
        // fatality/finality semantics attributed to
        // conferenceFailed:/onConferenceFailed).
        if (session && session.conference === conference) {
            if (!error || isGameOver(store, session, error)) {
                if (session.connection) {
                    store.dispatch(
                        setSession({
                            url: session.url,
                            conference: undefined
                        }));
                } else {
                    store.dispatch(
                        setSession({
                            url: session.url,
                            state: error ? SESSION_FAILED : SESSION_ENDED,
                            error
                        }));
                }
            }
        } else {
            console.info(`IGNORED FAILED/LEFT for ${url}`, error);
        }
        break;
    }

    // NOTE WILL_JOIN is fired on SET_ROOM
    // case CONFERENCE_WILL_JOIN:
    case CONFERENCE_WILL_LEAVE: {
        const { conference } = action;
        const url = toURLString(conference[JITSI_CONFERENCE_URL_KEY]);
        const session = _getSessionForConferenceAction(store, action);
        const state = session && session.state;

        if (state
                && state !== SESSION_WILL_END
                && conference === session.conference) {
            store.dispatch(
                setSession({
                    url: session.url,
                    state: SESSION_WILL_END
                }));
        } else {
            console.info(`IGNORED WILL LEAVE FOR ${url}`);
        }
        break;
    }

    case CONNECTION_WILL_CONNECT: {
        const { connection } = action;
        const url = toURLString(connection[JITSI_CONFERENCE_URL_KEY]);
        const session = getSession(store, url);

        if (session) {
            store.dispatch(
                setSession({
                    url: session.url,
                    connection,
                    conference: undefined // Detach from the old conference
                }));
        } else {
            console.info(`IGNORED CONNECTION_WILL_CONNECT FOR: ${url}`);
        }
        break;
    }

    case CONNECTION_DISCONNECTED:
    case CONNECTION_FAILED: {
        const { connection, error } = action;
        const url = toURLString(connection[JITSI_CONFERENCE_URL_KEY]);
        const session = getSession(store, url);

        if (session && session.connection === connection) {
            // Remove connection from the session, but wait for
            // the conference to be removed as well.
            if (!error || isGameOver(store, session, error)) {
                if (session.conference) {
                    store.dispatch(
                        setSession({
                            url,
                            connection: undefined
                        }));
                } else {
                    store.dispatch(
                        setSession({
                            url,
                            state: error ? SESSION_FAILED : SESSION_ENDED,
                            error
                        }));
                }
            }
        }
        break;
    }
    case CONFIG_WILL_LOAD: {
        const { locationURL } = action;
        const room = getRoomFromLocationURL(locationURL);
        const url = toURLString(locationURL);
        const session = getSession(store, url);

        // Update to the new locationURL instance
        if (session && room) {
            store.dispatch(
                setSession({
                    url,
                    locationURL
                }));
        } else if (room) {
            store.dispatch(
                setSession({
                    url,
                    state: SESSION_WILL_START,
                    locationURL
                }));
        } else {
            console.info(`IGNORED CFG WILL LOAD FOR ${url}`);
        }
        break;
    }
    case LOAD_CONFIG_ERROR: {
        const { error, locationURL } = action;
        const url = toURLString(locationURL);
        const session = getSession(store, url);

        if (session && session.locationURL === locationURL) {
            if (isGameOver(store, session, error)) {
                store.dispatch(
                    setSession({
                        url,
                        state: SESSION_FAILED,
                        error
                    }));
            }
        } else {
            console.info(`IGNORED LOAD_CONFIG_ERROR FOR: ${url}`);
        }
        break;
    }
    }

    return result;
});

function isGameOver(store, session, error) {
    return getCurrentSession(store) !== session || error.recoverable === false;
}

function getRoomFromLocationURL(locationURL) {
    const { room } = parseURIString(toURLString(locationURL));

    return isRoomValid(room) ? room : undefined;
}

function getSession(stateful, url) {
    const state = toState(stateful);

    return state['features/base/session'].get(url);
}

/**
 * FIXME.
 *
 * @param {Object} store - FIXME.
 * @param {Object} action - FIXME.
 * @returns {*} - FIXME.
 * @private
 */
function _getSessionForConferenceAction(
        store: Object,
        action: {
            conference: Object,
            type: Symbol,
            url: ?string
        }) {
    const { conference } = action;

    // For these (redux) actions, conference identifies a JitsiConference
    // instance. The external API cannot transport such an object so we have to
    // transport an "equivalent".
    if (conference) {
        const url = toURLString(conference[JITSI_CONFERENCE_URL_KEY]);

        return getSession(store, url);
    }

    return null;
}
