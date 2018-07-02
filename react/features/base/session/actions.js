import { SET_SESSION } from './actionTypes';

/**
 * FIXME.
 *
 * @param {string} session - FIXME.
 * @public
 * @returns {{
 *     type: SET_SESSION,
 *     {
 *         url: {string},
 *         state: {string},
 *         ...whatever you like to put here
 *     }
 * }}
 */
export function setSession(session) {
    return {
        type: SET_SESSION,
        session
    };
}
