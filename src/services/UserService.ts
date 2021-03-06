import io from '../utils/SocketContext';
import * as rword from 'rword';
import * as Constants from '../utils/Constants';
import * as Types from '../utils/Types';
import { Logger } from './Logger';
const logger = new Logger('user-service');
const TrieSearch = require('trie-search');

/**
 * Trie of users for fast lookup
 */
let usersTrie = new TrieSearch('displayName');

/**
 * Returns random hex color
 */
function generateRandomColor(): string {
    let colors = ['#FBE8A6']; // choose set of colors that fit with the color scheme
    return colors[Math.floor(Math.random() * colors.length)];
}

export class UserService {
    users: Types.UserDisplayMap;

    constructor() {
        this.users = {};
    }
    
    /**
     * Creates and returns new user
     *
     * @param {string} socketId - user id
     */
    createNewUser(socketId: string) {
        const displayName: string = (rword.rword.generate(2, { length: '2 - 6' }) as string[]).join('');
        this.users[socketId] = { userId: socketId, displayName, color: generateRandomColor() };
        usersTrie = new TrieSearch('displayName');
        usersTrie.addAll(Object.values(this.users));
        return this.users[socketId];
    }

    /**
     * Gets a random number of users from the entire list of users
     * TODO: This is temporary. We will want to get a RELEVANT subset of users (friends, common peers)
     */
    getRandomUsers() {
        const numUsers = 5;
        let subset: Types.UserDisplayMap = {};
        let userIds = Object.keys(this.users);
        for (let i = 0; i < numUsers; i++) {
            let randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
            subset[randomUserId] = this.users[randomUserId];
        }

        return subset;
    }

    /**
     * Returns all users that match the prefix searchTerm
     *
     * @param searchTerm - prefix to search for
     */
    searchUsers(searchTerm: string) {
        return usersTrie.get(searchTerm);
    }

    /**
     * Get user object
     * @param userId - user id to get object
     */
    getUser(userId: string) {
        return this.users[userId];
    }

    disconnectUser(userId: string) {
        logger.logInfo(`${this.users[userId]} disconnected from Jump`);
        delete this.users[userId];
        usersTrie = new TrieSearch('displayName');
        usersTrie.addAll(Object.values(this.users));
        // TODO: This would refresh list of users every time someone disconnects
        io.emit(Constants.USERS, this.getRandomUsers());
    }
}