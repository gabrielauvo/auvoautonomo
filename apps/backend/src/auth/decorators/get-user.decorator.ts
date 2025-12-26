/**
 * GetUser Decorator
 *
 * Alias para CurrentUser para manter consistência no admin module
 */

import { CurrentUser } from './current-user.decorator';

export const GetUser = CurrentUser;
