module.exports = function(app){
    const user = require('../controllers/userController');
    const jwtMiddleware = require('../../../config/jwtMiddleware');

    app.route('/login/join').post(user.postJoin);
    app.route('/login').post(user.postLogin);

    app.get('/user',jwtMiddleware, user.getUser);
};