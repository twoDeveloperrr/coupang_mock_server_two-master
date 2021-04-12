module.exports = function(app){
    const delivery = require('../controllers/deliveryController');
    const jwtMiddleware = require('../../../config/jwtMiddleware');

    // 배송지 추가
    app.route('/delivery').post(jwtMiddleware, delivery.postOrderDelivery);

    // 베송지 정보 조회
    app.get('/delivery/management', jwtMiddleware, delivery.getOrderDelivery);

    // 배송지 수정
    app.route('/delivery/:deliveryRow').patch(jwtMiddleware, delivery.patchOrderDelivery);
    // 배송지 삭제
    app.route('/delivery/:deliveryRow').delete(jwtMiddleware, delivery.deleteOrderDelivery);

    // 기본배송지 설정
    app.route('/delivery-check').post(jwtMiddleware, delivery.postOrderCheckDelivery);
};