import os.path
from django.utils import simplejson
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.api import memcache


class GameHandler(webapp.RequestHandler):

    TIME = 3600 # an hour

    def high_score(self):
        return memcache.get('high_score') or 0

    def set_high_score(self, higher_score):
        if higher_score <= self.high_score:
            raise ValueError('the given score is less then the high score')
        memcache.set('high_score', higher_score, self.TIME)

    high_score = property(high_score, set_high_score)

    def get(self):
        context = dict(high_score=self.high_score)
        self.response.out.write(template.render('game.html', context))


class HighScoreHandler(GameHandler):

    def get(self):
        self.response.out.write(simplejson.dumps(self.high_score))

    def post(self):
        my_score = int(self.request.get('my_score'))
        try:
            self.high_score = my_score
            updated = True
        except ValueError:
            updated = False
        self.response.out.write(simplejson.dumps(updated))


application = webapp.WSGIApplication([
    ('/', GameHandler),
    ('/high-score', HighScoreHandler)
])


if __name__ == '__main__':
    from google.appengine.ext.webapp.util import run_wsgi_app
    run_wsgi_app(application)
