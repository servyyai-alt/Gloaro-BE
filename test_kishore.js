require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const user = await User.findOne({ email: 'kishore@gmail.com' });
    if(user) {
      console.log('User Role:', user.role);
      console.log('User object:', JSON.stringify(user, null, 2));
    } else {
      console.log('User not found');
    }
    process.exit(0);
  });
