// @flow

import { NativeModules } from 'react-native';

import { getAppProp } from '../../app';
import { MiddlewareRegistry } from '../../base/redux';
import { ENTER_PICTURE_IN_PICTURE } from '../picture-in-picture';
import { SET_SESSION } from '../../base/session';

import { _getSymbolDescription } from './functions';
import {
    SESSION_ENDED,
    SESSION_FAILED,
    SESSION_STARTED,
    SESSION_WILL_END,
    SESSION_WILL_START
} from '../../base/session';
import {
    CONFERENCE_FAILED,
    CONFERENCE_JOINED,
    CONFERENCE_LEFT,
    CONFERENCE_WILL_JOIN,
    CONFERENCE_WILL_LEAVE
} from '../../base/conference';

let _stateToApiEventName;

function stateToApiEventName() {
    if (!_stateToApiEventName) {
        _stateToApiEventName = new Map();
        _stateToApiEventName.set(
            SESSION_WILL_START,
            _getSymbolDescription(CONFERENCE_WILL_JOIN));
        _stateToApiEventName.set(
            SESSION_STARTED,
            _getSymbolDescription(CONFERENCE_JOINED));
        _stateToApiEventName.set(
            SESSION_WILL_END,
            _getSymbolDescription(CONFERENCE_WILL_LEAVE));
        _stateToApiEventName.set(
            SESSION_ENDED,
            _getSymbolDescription(CONFERENCE_LEFT));
        _stateToApiEventName.set(
            SESSION_FAILED,
            _getSymbolDescription(CONFERENCE_FAILED));
    }

    return _stateToApiEventName;
}

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
    case SET_SESSION: {
        const { error, state, url } = action.session;
        const apiEventName = stateToApiEventName().get(state);

        apiEventName && _sendEvent(
            store,
            apiEventName,
            /* data */ {
                url,
                error: error && _toErrorString(error)
            });

        break;
    }

    case ENTER_PICTURE_IN_PICTURE:
        _sendEvent(store, _getSymbolDescription(type), /* data */ {});
        break;
    }

    return result;
});

/**
 * Returns a {@code String} representation of a specific error {@code Object}.
 *
 * @param {Error|Object|string} error - The error {@code Object} to return a
 * {@code String} representation of.
 * @returns {string} A {@code String} representation of the specified
 * {@code error}.
 */
function _toErrorString(
        error: Error | { message: ?string, name: ?string } | string) {
    // XXX In lib-jitsi-meet and jitsi-meet we utilize errors in the form of
    // strings, Error instances, and plain objects which resemble Error.
    return (
        error
            ? typeof error === 'string'
                ? error
                : Error.prototype.toString.apply(error)
            : '');
}

/**
 * Sends a specific event to the native counterpart of the External API. Native
 * apps may listen to such events via the mechanisms provided by the (native)
 * mobile Jitsi Meet SDK.
 *
 * @param {Object} store - The redux store.
 * @param {string} name - The name of the event to send.
 * @param {Object} data - The details/specifics of the event to send determined
 * by/associated with the specified {@code name}.
 * @private
 * @returns {void}
 */
function _sendEvent(store: Object, name: string, data: Object) {
    // The JavaScript App needs to provide uniquely identifying information to
    // the native ExternalAPI module so that the latter may match the former to
    // the native JitsiMeetView which hosts it.
    const externalAPIScope = getAppProp(store, 'externalAPIScope');

    externalAPIScope
        && NativeModules.ExternalAPI.sendEvent(name, data, externalAPIScope);
}
