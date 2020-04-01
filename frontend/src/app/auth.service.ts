import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { WebRequestService } from './web-request.service';
import { Router } from '@angular/router';
import { shareReplay, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class AuthService {


  constructor(private webService: WebRequestService, private router: Router, private http: HttpClient) { }

  login(email: string, password: string) {
    return this.webService.login(email, password).pipe(
      shareReplay(),
      tap((res: HttpResponse<any>) => {
        // the auth tokens will be in the header of this response

        this.setSession(res.body, res.headers);
        console.log("LOGGED IN!");
      })
    )
  }


  signup(name: string, email: string, password: string, sitekey: string) {
    return this.webService.signup(name, email, password, sitekey).pipe(
      shareReplay(),
      tap((res: HttpResponse<any>) => {
        console.log('res.body', res.body);
        console.log('res.headers', res.headers);
        // the auth tokens will be in the header of this response
        this.setSession(res.body, res.headers);
        // console.log("Successfully signed up and now logged in!");
      })
    )
  }



  logout() {
    this.removeSession();

    this.router.navigate(['/login']);
  }

  getAccessToken() {
    return localStorage.getItem('x-access-token');
  }

  getRefreshToken() {
    return localStorage.getItem('x-refresh-token');
  }

  getUserId() {
    return localStorage.getItem('id');
  }

  getUserName() {
    return localStorage.getItem('name');
  }

  setAccessToken(accessToken: string) {
    localStorage.setItem('x-access-token', accessToken)
  }

  private setSession(body, headers) {

    const user = {
      'name': body.name,
      'id': body._id,
      'x-access-token': headers.get('x-access-token'),
      'x-refresh-token': headers.get('x-refresh-token')
    }

    localStorage.setItem('name', user.name);
    localStorage.setItem('id', user.id);
    localStorage.setItem('x-access-token', user['x-access-token']);
    localStorage.setItem('x-refresh-token', user['x-refresh-token']);

  }

  private removeSession() {
    localStorage.removeItem('name');
    localStorage.removeItem('id');
    localStorage.removeItem('x-access-token');
    localStorage.removeItem('x-refresh-token');
  }

  getNewAccessToken() {
    return this.http.get(`${this.webService.ROOT_URL}/users/me/access-token`, {
      headers: {
        'x-refresh-token': this.getRefreshToken(),
        '_id': this.getUserId()
      },
      observe: 'response'
    }).pipe(
      tap((res: HttpResponse<any>) => {
        this.setAccessToken(res.headers.get('x-access-token'));
      })
    )
  }
}