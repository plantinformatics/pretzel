import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {compare} from 'bcryptjs';
import {UserService} from '@loopback/authentication';
import {User, Credentials} from '@loopback/authentication-jwt';
import {Client} from '../models';
import {ClientRepository} from '../repositories';


export class ClientUserService implements UserService<User, Credentials> {
  constructor(
    @repository(ClientRepository)
    public clientRepository: ClientRepository,
  ) {}

  async verifyCredentials(credentials: Credentials): Promise<Client> {
    const invalidCredentialsError = 'Invalid email or password.';
    const foundUser = await this.clientRepository.findOne({
      where: {email: credentials.email},
    });
    if (!foundUser) {
      throw new HttpErrors.Unauthorized(invalidCredentialsError);
    }
    const storedHash = (foundUser as any).password;
    if (!storedHash) {
      throw new HttpErrors.Unauthorized(invalidCredentialsError);
    }
    const passwordMatched = await compare(credentials.password, storedHash);
    if (!passwordMatched) {
      throw new HttpErrors.Unauthorized(invalidCredentialsError);
    }
    return foundUser;
  }

  convertToUserProfile(user: Client): UserProfile {
    return {
      [securityId]: user.id?.toString() ?? '',
      name: user.username,
      id: user.id,
      email: user.email,
    };
  }

  async findUserById(id: string): Promise<Client> {
    const userNotfound = 'invalid User';
    try {
      return await this.clientRepository.findById(id);
    } catch {
      throw new HttpErrors.Unauthorized(userNotfound);
    }
  }
}
