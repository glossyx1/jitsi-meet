// @flow

import { toState } from '../redux';
import { toURLString } from '../util';

export function getSession(stateful: Function | Object, url: string): ?Object {
    const state = toState(stateful);

    const session = state['features/base/session'].get(url);

    if (!session) {
        console.info(`SESSION NOT FOUND FOR URL: ${url}`);
    }

    return session;
}

export function getCurrentSession(stateful: Function | Object): ?Object {
    const state = toState(stateful);
    const { locationURL } = state['features/base/config'];

    return getSession(state, toURLString(locationURL));
}

/**
 * Returns a {@code String} representation of a specific error {@code Object}.
 *
 * @param {Error|Object|string} error - The error {@code Object} to return a
 * {@code String} representation of.
 * @returns {string} A {@code String} representation of the specified
 * {@code error}.
 */
export function toErrorString(
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
