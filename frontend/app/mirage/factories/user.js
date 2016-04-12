import Mirage from 'ember-cli-mirage';

export default Mirage.Factory.extend(
  {firstName: 'MyString', lastName: 'MyString', email: 'MyString', apiKey: 'MyString', age: 42, subscribed: false, verified: false }
);
