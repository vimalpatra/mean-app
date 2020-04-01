import { Injectable } from '@angular/core';
import { RouterStateSnapshot, CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})

export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) { }

  canActivate(route, state: RouterStateSnapshot) {

    const id = this.authService.getUserId();
    const accessToken = this.authService.getAccessToken();

    if (!id && !accessToken) {
      // set the query paramaters returnUrl as this url and redirect to a new page
      this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    return true;


  }

}
