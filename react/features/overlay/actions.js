import { appNavigate, reloadWithStoredParams } from '../app';
import { toURLString } from '../base/util';

import {
    MEDIA_PERMISSION_PROMPT_VISIBILITY_CHANGED,
    SET_FATAL_ERROR,
    SUSPEND_DETECTED
} from './actionTypes';
import { setSession } from '../base/session/actions';
import { SESSION_FAILED } from '../base/session/constants';
import { getCurrentSession } from '../base/session/functions';
import { toErrorString } from '../base/session';

const logger = require('jitsi-meet-logger').getLogger(__filename);

/**
 * Signals that the prompt for media permission is visible or not.
 *
 * @param {boolean} isVisible - If the value is true - the prompt for media
 * permission is visible otherwise the value is false/undefined.
 * @param {string} browser - The name of the current browser.
 * @public
 * @returns {{
 *     type: MEDIA_PERMISSION_PROMPT_VISIBILITY_CHANGED,
 *     browser: {string},
 *     isVisible: {boolean}
 * }}
 */
export function mediaPermissionPromptVisibilityChanged(isVisible, browser) {
    return {
        type: MEDIA_PERMISSION_PROMPT_VISIBILITY_CHANGED,
        browser,
        isVisible
    };
}

/**
 * Reloads the page.
 *
 * @protected
 * @returns {Function}
 */
export function _reloadNow() {
    return (dispatch, getState) => {
        dispatch(setFatalError(undefined));

        const { locationURL } = getState()['features/base/connection'];

        logger.info(`Reloading the conference using URL: ${locationURL}`);

        if (navigator.product === 'ReactNative') {
            dispatch(appNavigate(toURLString(locationURL)));
        } else {
            dispatch(reloadWithStoredParams());
        }
    };
}

/**
 * Signals that suspend was detected.
 *
 * @public
 * @returns {{
 *     type: SUSPEND_DETECTED
 * }}
 */
export function suspendDetected() {
    return {
        type: SUSPEND_DETECTED
    };
}

/**
 * The action indicates that an unrecoverable error has occurred and the reload
 * screen will be displayed or hidden.
 *
 * @param {Object} fatalError - A critical error which was not claimed by any
 * feature for error recovery (the recoverable flag was not set). If
 * {@code undefined} then any fatal error currently stored will be discarded.
 * @returns {{
 *     type: SET_FATAL_ERROR,
 *     fatalError: ?Error
 * }}
 */
export function setFatalError(fatalError) {
    return {
        type: SET_FATAL_ERROR,
        fatalError
    };
}

/**
 * FIXME naming is not quite accurate - came from the previous method which was
 * reemitting the action.
 *
 * @return {Function}
 */
export function reemitFatalError() {
    return (dispatch, getState) => {
        const state = getState();

        // const { error: conferenceError } = state['features/base/conference'];
        // const { error: configError } = state['features/base/config'];
        // const { error: connectionError } = state['features/base/connection'];
        const { fatalError } = state['features/overlay'];

        if (fatalError) {
            const session = getCurrentSession(state);

            if (session) {
                dispatch(
                    setSession({
                        url: session.url,
                        state: SESSION_FAILED,
                        error: toErrorString(fatalError)
                    }));
            } else {
                console.info('No current session!');
            }
            dispatch(setFatalError(undefined));
        } else {
            console.info('NO FATAL ERROR');
        }
    };
}
