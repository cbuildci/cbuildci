'use strict';

/**
 * Validate that an event contains repository metadata.
 *
 * @param {object} ctx
 * @param {object} ghEvent
 */
exports.validateRepositoryEvent = function validateRepositoryEvent(ctx, ghEvent) {
    if (!ghEvent.repository) {
        ctx.throw(400, 'Missing "repository" property');
    }

    if (typeof ghEvent.repository.id !== 'number') {
        ctx.throw(400, 'Missing or invalid "repository.id" property');
    }

    if (typeof ghEvent.repository.name !== 'string') {
        ctx.throw(400, 'Missing or invalid "repository.name" property');
    }

    if (!ghEvent.repository.owner) {
        ctx.throw(400, 'Missing "repository.owner" property');
    }

    if (typeof ghEvent.repository.owner.id !== 'number') {
        ctx.throw(400, 'Missing or invalid "repository.owner.id" property');
    }

    if (typeof ghEvent.repository.owner.login !== 'string') {
        ctx.throw(400, 'Missing or invalid "repository.owner.login" property');
    }

    if (typeof ghEvent.repository.owner.type !== 'string') {
        ctx.throw(400, 'Missing or invalid "repository.owner.type" property');
    }
};
