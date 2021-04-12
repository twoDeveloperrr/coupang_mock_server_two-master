module.exports = function(app){
    const review = require('../controllers/reviewController');
    const jwtMiddleware = require('../../../config/jwtMiddleware');

    //리뷰작성
    app.route('/product/:productIdx/review').post(jwtMiddleware, review.postReview);
    //리뷰 삭제
    app.route('/product/:productIdx/review').delete(jwtMiddleware, review.deleteReview);
    //리뷰 도움이 됐서요
    app.route('/product/:productIdx/review-like').post(jwtMiddleware, review.postReviewLike);
    //리뷰 조회
    app.get('/product/:productIdx/review-best', review.getReviewBest);
    app.get('/product/:productIdx/review-lately', review.getReviewLately);

};