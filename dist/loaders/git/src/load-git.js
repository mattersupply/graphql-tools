import simplegit from 'simple-git/promise';
import simplegitSync from 'simple-git';
const createLoadError = (error) => new Error('Unable to load schema from git: ' + error);
const createCommand = ({ ref, path }) => {
    return [`${ref}:${path}`];
};
export async function loadFromGit(input) {
    try {
        const git = simplegit();
        return await git.show(createCommand(input));
    }
    catch (error) {
        throw createLoadError(error);
    }
}
export function loadFromGitSync(input) {
    try {
        const git = simplegitSync();
        return git.show(createCommand(input));
    }
    catch (error) {
        throw createLoadError(error);
    }
}
//# sourceMappingURL=load-git.js.map