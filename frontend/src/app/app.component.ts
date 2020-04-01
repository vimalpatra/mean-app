import { Component, OnInit } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {
    const id = this.authService.getUserId();
    const accessToken = this.authService.getAccessToken();

    console.log('id', id);
    console.log('access tojen', accessToken);

    if (!id && !accessToken) return;

    // go to the return url
    const returnUrl: string = localStorage.getItem('returnUrl');

    if (!returnUrl) return;

    localStorage.removeItem('returnUrl');

    this.router.navigateByUrl(returnUrl);

  }
}
