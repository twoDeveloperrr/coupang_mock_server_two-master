module.exports = function(app){
    const profile = require('../controllers/profileController');
    const jwtMiddleware = require('../../../config/jwtMiddleware');

    // 내정보관리
    app.get('/profile/management', jwtMiddleware, profile.getProfileManagement);

    // 상단부분
    app.get('/profile', jwtMiddleware, profile.getProfile);

    //쿠폰
    app.get('/profile/coupon', jwtMiddleware, profile.coupon);
};